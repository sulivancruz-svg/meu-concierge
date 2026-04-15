import type { Prisma } from '@prisma/client';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { prisma } from '../db';
import { readDocumentMetadata } from '@/modules/documents/document-meta';

type SuggestedDocument = {
  id: string;
  title: string;
  category: string;
};

type ConciergeReply = {
  text: string;
  suggestedDocuments: SuggestedDocument[];
  shouldAutoSendSuggestedDocument: boolean;
  source: 'structured' | 'documents' | 'none';
};

type TripItemType = 'FLIGHT' | 'HOTEL' | 'TRANSPORT' | 'TOUR' | 'TRAIN' | 'INSURANCE' | 'NOTE';

type TripItemRecord = {
  id: string;
  type: TripItemType;
  title: string;
  providerName: string | null;
  startAt: Date | null;
  endAt: Date | null;
  location: string | null;
  confirmationCode: string | null;
  description: string | null;
  sortOrder: number;
};

type TripDocumentRecord = {
  id: string;
  name: string;
  category: string;
  tripItemId: string | null;
  structuredMetadata: Prisma.JsonValue | null;
};

type ConciergeContext = {
  trip: {
    id: string;
    title: string;
    destination: string | null;
    tripItems: TripItemRecord[];
    documents: TripDocumentRecord[];
  };
  passengerName: string | null;
};

const KEYWORDS_BY_TYPE: Record<TripItemType, string[]> = {
  FLIGHT: ['voo', 'embarque', 'boarding', 'passagem', 'aviao'],
  HOTEL: ['hotel', 'hospedagem', 'check in', 'check-in', 'checkin', 'reserva'],
  TRANSPORT: ['transfer', 'transporte', 'translado', 'motorista', 'carro'],
  TOUR: ['passeio', 'tour', 'ingresso', 'excursao', 'louvre'],
  TRAIN: ['trem', 'train', 'ticket de trem'],
  INSURANCE: ['seguro', 'apolice', 'cobertura', 'emergencia'],
  NOTE: ['observacao', 'nota'],
};

const DOCUMENT_HINTS_BY_TYPE: Record<TripItemType, string[]> = {
  FLIGHT: ['boarding_pass'],
  HOTEL: ['hotel_voucher'],
  TRANSPORT: ['transport_voucher', 'car_rental_voucher'],
  TOUR: ['tour_voucher'],
  TRAIN: ['train_ticket'],
  INSURANCE: ['insurance'],
  NOTE: ['other'],
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return null;
  }

  return format(value, "dd/MM 'as' HH:mm", { locale: ptBR });
}

function formatDateOnly(value: Date | null) {
  if (!value) {
    return null;
  }

  return format(value, 'dd/MM', { locale: ptBR });
}

function getFirstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] ?? null;
}

function greet(name: string | null, message: string) {
  const firstName = getFirstName(name);
  return firstName ? `Oi, ${firstName}. ${message}` : message;
}

function sortTripItems(items: TripItemRecord[]) {
  return [...items].sort((left, right) => {
    if (left.startAt && right.startAt) {
      return left.startAt.getTime() - right.startAt.getTime();
    }
    if (left.startAt) {
      return -1;
    }
    if (right.startAt) {
      return 1;
    }
    return left.sortOrder - right.sortOrder;
  });
}

function pickUpcomingItem(items: TripItemRecord[]) {
  const ordered = sortTripItems(items);
  const now = new Date();
  return ordered.find((item) => item.startAt && item.startAt.getTime() >= now.getTime()) ?? ordered[0] ?? null;
}

function pickItemsByType(items: TripItemRecord[], type: TripItemType) {
  return sortTripItems(items.filter((item) => item.type === type));
}

function noInfoReply(passengerName: string | null): ConciergeReply {
  return {
    text: greet(passengerName, 'nao encontrei essa informacao cadastrada na sua viagem ativa.'),
    suggestedDocuments: [],
    shouldAutoSendSuggestedDocument: false,
    source: 'none',
  };
}

function isDocumentSendIntent(normalized: string) {
  return includesAny(normalized, [
    'me envie',
    'me envia',
    'me manda',
    'manda',
    'manda o',
    'manda a',
    'envie',
    'envia',
    'enviar',
    'arquivo',
    'documento',
    'pdf',
    'voucher',
    'cartao de embarque',
    'boarding pass',
    'passagem',
    'ticket',
    'bilhete',
    'reserva',
  ]);
}

async function buildConciergeContext(tripId: string, passengerId?: string | null): Promise<ConciergeContext | null> {
  const [trip, passenger] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        title: true,
        destination: true,
        tripItems: {
          where: passengerId
            ? {
                OR: [
                  { passengerId: null },
                  { passengerId },
                ],
              }
            : undefined,
          orderBy: [{ startAt: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            type: true,
            title: true,
            providerName: true,
            startAt: true,
            endAt: true,
            location: true,
            confirmationCode: true,
            description: true,
            sortOrder: true,
          },
        },
        documents: {
          where: {
            deletedAt: null,
            ...(passengerId
              ? {
                  OR: [
                    { passengerId: null },
                    { passengerId },
                  ],
                }
              : {}),
          },
          orderBy: [{ isEssential: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            name: true,
            category: true,
            tripItemId: true,
            structuredMetadata: true,
          },
        },
      },
    }),
    passengerId
      ? prisma.passenger.findUnique({
          where: { id: passengerId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  if (!trip) {
    return null;
  }

  return {
    trip: {
      ...trip,
      documents: trip.documents,
    },
    passengerName: passenger?.name ?? null,
  };
}

function findRelevantDocuments(
  context: ConciergeContext,
  query: string,
  focus?: { itemType?: TripItemType; itemId?: string | null },
) {
  const normalized = normalizeText(query);
  const itemsById = new Map(context.trip.tripItems.map((item) => [item.id, item]));

  return [...context.trip.documents]
    .map((document) => {
      const meta = readDocumentMetadata(document.structuredMetadata);
      const linkedItem = document.tripItemId ? itemsById.get(document.tripItemId) ?? null : null;
      let score = 0;

      if (focus?.itemId && document.tripItemId === focus.itemId) {
        score += 10;
      }

      if (focus?.itemType && linkedItem?.type === focus.itemType) {
        score += 6;
      }

      if (focus?.itemType && DOCUMENT_HINTS_BY_TYPE[focus.itemType].includes(meta.categoryKey ?? '')) {
        score += 5;
      }

      if (linkedItem && normalized.includes(normalizeText(linkedItem.title))) {
        score += 6;
      }

      if (meta.linkedEntityLabel && normalized.includes(normalizeText(meta.linkedEntityLabel))) {
        score += 4;
      }

      if (normalized.includes(normalizeText(document.name))) {
        score += 4;
      }

      if (focus?.itemType && includesAny(normalized, KEYWORDS_BY_TYPE[focus.itemType])) {
        score += 3;
      }

      if (includesAny(normalized, ['voucher', 'documento', 'arquivo', 'pdf', 'ingresso'])) {
        score += 1;
      }

      return {
        document,
        score,
        categoryKey: meta.categoryKey ?? 'other',
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => ({
      id: item.document.id,
      title: item.document.name,
      category: item.categoryKey,
    }));
}

function withDocumentSuggestion(
  passengerName: string | null,
  text: string,
  documents: SuggestedDocument[],
  source: 'structured' | 'documents' = 'structured',
): ConciergeReply {
  if (!documents.length) {
    return {
      text: greet(passengerName, text),
      suggestedDocuments: [],
      shouldAutoSendSuggestedDocument: false,
      source,
    };
  }

  return {
    text: greet(passengerName, `${text} Posso enviar o documento relacionado se voce quiser.`),
    suggestedDocuments: documents,
    shouldAutoSendSuggestedDocument: false,
    source,
  };
}

export async function generateConciergeMockReply(input: {
  message: string;
  tripId: string;
  passengerId?: string | null;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<ConciergeReply> {
  const context = await buildConciergeContext(input.tripId, input.passengerId);

  if (!context) {
    return {
      text: 'Nao encontrei essa viagem no sistema.',
      suggestedDocuments: [],
      shouldAutoSendSuggestedDocument: false,
      source: 'none',
    };
  }

  const normalized = normalizeText(input.message);
  const flightItems = pickItemsByType(context.trip.tripItems, 'FLIGHT');
  const hotelItems = pickItemsByType(context.trip.tripItems, 'HOTEL');
  const transportItems = pickItemsByType(context.trip.tripItems, 'TRANSPORT');
  const tourItems = pickItemsByType(context.trip.tripItems, 'TOUR');
  const trainItems = pickItemsByType(context.trip.tripItems, 'TRAIN');
  const insuranceItems = pickItemsByType(context.trip.tripItems, 'INSURANCE');
  const nextItem = pickUpcomingItem(context.trip.tripItems);

  if (isDocumentSendIntent(normalized)) {
    const focusType = includesAny(normalized, KEYWORDS_BY_TYPE.FLIGHT)
      ? 'FLIGHT'
      : includesAny(normalized, KEYWORDS_BY_TYPE.HOTEL)
        ? 'HOTEL'
        : includesAny(normalized, KEYWORDS_BY_TYPE.TRANSPORT)
          ? 'TRANSPORT'
          : includesAny(normalized, KEYWORDS_BY_TYPE.TOUR)
            ? 'TOUR'
            : includesAny(normalized, KEYWORDS_BY_TYPE.TRAIN)
              ? 'TRAIN'
              : includesAny(normalized, KEYWORDS_BY_TYPE.INSURANCE)
                ? 'INSURANCE'
                : undefined;
    const documents = findRelevantDocuments(context, normalized, focusType ? { itemType: focusType } : undefined);

    if (!documents.length) {
      return {
        text: greet(context.passengerName, 'nao encontrei documento relacionado a esse pedido.'),
        suggestedDocuments: [],
        shouldAutoSendSuggestedDocument: false,
        source: 'none',
      };
    }

    if (documents.length === 1) {
      return {
        text: greet(context.passengerName, `encontrei o documento ${documents[0].title} e vou enviar esse arquivo agora.`),
        suggestedDocuments: documents,
        shouldAutoSendSuggestedDocument: true,
        source: 'documents',
      };
    }

    return {
      text: greet(context.passengerName, `encontrei ${documents.length} documentos relacionados e vou enviar o arquivo mais adequado agora.`),
      suggestedDocuments: documents,
      shouldAutoSendSuggestedDocument: true,
      source: 'documents',
    };
  }

  if (includesAny(normalized, ['localizador', 'codigo', 'reserva', 'confirmacao'])) {
    const codedItems = sortTripItems(context.trip.tripItems.filter((item) => item.confirmationCode));
    const focused = includesAny(normalized, KEYWORDS_BY_TYPE.FLIGHT)
      ? flightItems.find((item) => item.confirmationCode)
      : includesAny(normalized, KEYWORDS_BY_TYPE.HOTEL)
        ? hotelItems.find((item) => item.confirmationCode)
        : includesAny(normalized, KEYWORDS_BY_TYPE.TRANSPORT)
          ? transportItems.find((item) => item.confirmationCode)
          : codedItems[0];

    if (!focused || !focused.confirmationCode) {
      return noInfoReply(context.passengerName);
    }

    return {
      text: greet(context.passengerName, `o localizador de ${focused.title} e ${focused.confirmationCode}.`),
      suggestedDocuments: findRelevantDocuments(context, normalized, { itemType: focused.type, itemId: focused.id }),
      shouldAutoSendSuggestedDocument: false,
      source: 'structured',
    };
  }

  if (includesAny(normalized, ['qual e meu voo', 'qual meu voo', 'meu voo', 'voo'])) {
    const flight = pickUpcomingItem(flightItems);
    if (!flight) {
      return noInfoReply(context.passengerName);
    }

    const dateLabel = formatDateTime(flight.startAt);
    const locationLabel = flight.location ? ` saindo de ${flight.location}` : '';
    const providerLabel = flight.providerName ? ` pela ${flight.providerName}` : '';
    const codeLabel = flight.confirmationCode ? ` Localizador: ${flight.confirmationCode}.` : '';

    return withDocumentSuggestion(
      context.passengerName,
      `seu voo e ${flight.title}${providerLabel}${dateLabel ? ` em ${dateLabel}` : ''}${locationLabel}.${codeLabel}`.trim(),
      findRelevantDocuments(context, normalized, { itemType: 'FLIGHT', itemId: flight.id }),
    );
  }

  if (includesAny(normalized, ['check in', 'check-in', 'checkin'])) {
    const hotel = pickUpcomingItem(hotelItems);
    if (!hotel) {
      return noInfoReply(context.passengerName);
    }

    return withDocumentSuggestion(
      context.passengerName,
      `seu check-in no ${hotel.title}${hotel.startAt ? ` comeca em ${formatDateTime(hotel.startAt)}` : ''}.`,
      findRelevantDocuments(context, normalized, { itemType: 'HOTEL', itemId: hotel.id }),
    );
  }

  if (includesAny(normalized, ['endereco do hotel', 'endereco hotel', 'onde fica o hotel', 'qual e o nome do meu hotel', 'nome do hotel', 'hotel'])) {
    const hotel = pickUpcomingItem(hotelItems);
    if (!hotel) {
      return noInfoReply(context.passengerName);
    }

    if (includesAny(normalized, ['endereco', 'onde fica'])) {
      if (!hotel.location) {
        return noInfoReply(context.passengerName);
      }

      return withDocumentSuggestion(
        context.passengerName,
        `o endereco do hotel ${hotel.title} e ${hotel.location}.`,
        findRelevantDocuments(context, normalized, { itemType: 'HOTEL', itemId: hotel.id }),
      );
    }

    return withDocumentSuggestion(
      context.passengerName,
      `seu hotel e ${hotel.title}${hotel.location ? `, em ${hotel.location}` : ''}${hotel.startAt ? `, com check-in em ${formatDateTime(hotel.startAt)}` : ''}.`,
      findRelevantDocuments(context, normalized, { itemType: 'HOTEL', itemId: hotel.id }),
    );
  }

  if (includesAny(normalized, ['passeio']) && includesAny(normalized, ['amanha', 'amanha?'])) {
    const tomorrow = addDays(startOfDay(new Date()), 1);
    const tomorrowTours = tourItems.filter((item) => item.startAt && isSameDay(item.startAt, tomorrow));

    if (!tomorrowTours.length) {
      return {
        text: greet(context.passengerName, `nao encontrei passeio cadastrado para ${formatDateOnly(tomorrow)}.`),
        suggestedDocuments: [],
        shouldAutoSendSuggestedDocument: false,
        source: 'none',
      };
    }

    const tour = tomorrowTours[0];
    return withDocumentSuggestion(
      context.passengerName,
      `amanha voce tem ${tour.title}${tour.startAt ? ` em ${formatDateTime(tour.startAt)}` : ''}${tour.location ? `, no local ${tour.location}` : ''}.`,
      findRelevantDocuments(context, normalized, { itemType: 'TOUR', itemId: tour.id }),
    );
  }

  if (includesAny(normalized, KEYWORDS_BY_TYPE.TRANSPORT)) {
    const transport = pickUpcomingItem(transportItems);
    if (!transport) {
      return noInfoReply(context.passengerName);
    }

    return withDocumentSuggestion(
      context.passengerName,
      `seu transfer e ${transport.title}${transport.startAt ? ` em ${formatDateTime(transport.startAt)}` : ''}${transport.location ? `, com saida de ${transport.location}` : ''}.`,
      findRelevantDocuments(context, normalized, { itemType: 'TRANSPORT', itemId: transport.id }),
    );
  }

  if (includesAny(normalized, KEYWORDS_BY_TYPE.TOUR)) {
    const tour = pickUpcomingItem(tourItems);
    if (!tour) {
      return noInfoReply(context.passengerName);
    }

    return withDocumentSuggestion(
      context.passengerName,
      `seu passeio e ${tour.title}${tour.startAt ? ` em ${formatDateTime(tour.startAt)}` : ''}${tour.location ? `, no local ${tour.location}` : ''}.`,
      findRelevantDocuments(context, normalized, { itemType: 'TOUR', itemId: tour.id }),
    );
  }

  if (includesAny(normalized, KEYWORDS_BY_TYPE.TRAIN)) {
    const train = pickUpcomingItem(trainItems);
    if (!train) {
      return noInfoReply(context.passengerName);
    }

    return withDocumentSuggestion(
      context.passengerName,
      `seu trem e ${train.title}${train.startAt ? ` em ${formatDateTime(train.startAt)}` : ''}.`,
      findRelevantDocuments(context, normalized, { itemType: 'TRAIN', itemId: train.id }),
    );
  }

  if (includesAny(normalized, KEYWORDS_BY_TYPE.INSURANCE)) {
    const insurance = pickUpcomingItem(insuranceItems) ?? insuranceItems[0] ?? null;
    if (!insurance) {
      return noInfoReply(context.passengerName);
    }

    return withDocumentSuggestion(
      context.passengerName,
      `seu seguro cadastrado e ${insurance.title}${insurance.providerName ? ` pela ${insurance.providerName}` : ''}${insurance.confirmationCode ? `, apolice ${insurance.confirmationCode}` : ''}.`,
      findRelevantDocuments(context, normalized, { itemType: 'INSURANCE', itemId: insurance.id }),
    );
  }

  if (includesAny(normalized, ['que horas', 'horario', 'hora', 'quando'])) {
    if (!nextItem || !nextItem.startAt) {
      return noInfoReply(context.passengerName);
    }

    return withDocumentSuggestion(
      context.passengerName,
      `o proximo item da sua viagem e ${nextItem.title} em ${formatDateTime(nextItem.startAt)}.`,
      findRelevantDocuments(context, normalized, { itemType: nextItem.type, itemId: nextItem.id }),
    );
  }

  if (!nextItem) {
    return {
      text: greet(
        context.passengerName,
        `encontrei sua viagem ativa ${context.trip.title}${context.trip.destination ? ` para ${context.trip.destination}` : ''}, mas ela ainda nao tem itens cadastrados.`,
      ),
      suggestedDocuments: [],
      shouldAutoSendSuggestedDocument: false,
      source: 'none',
    };
  }

  return withDocumentSuggestion(
    context.passengerName,
    `encontrei sua viagem ativa ${context.trip.title}${context.trip.destination ? ` para ${context.trip.destination}` : ''}. O proximo item e ${nextItem.title}${nextItem.startAt ? ` em ${formatDateTime(nextItem.startAt)}` : ''}.`,
    findRelevantDocuments(context, normalized, { itemType: nextItem.type, itemId: nextItem.id }),
  );
}

async function generateConciergeAIReply(input: {
  message: string;
  tripId: string;
  passengerId?: string | null;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<ConciergeReply> {
  const { anthropic, AI_MODEL } = await import('./anthropic');

  const context = await buildConciergeContext(input.tripId, input.passengerId);
  if (!context) {
    return {
      text: 'Nao encontrei essa viagem no sistema.',
      suggestedDocuments: [],
      shouldAutoSendSuggestedDocument: false,
      source: 'none',
    };
  }

  const itemsSummary = sortTripItems(context.trip.tripItems)
    .map((item) => {
      const parts = [`- [${item.type}] ${item.title}`];
      if (item.startAt) parts.push(`em ${formatDateTime(item.startAt)}`);
      if (item.location) parts.push(`local: ${item.location}`);
      if (item.confirmationCode) parts.push(`cod: ${item.confirmationCode}`);
      if (item.providerName) parts.push(`por ${item.providerName}`);
      return parts.join(' | ');
    })
    .join('\n');

  const docsSummary = context.trip.documents
    .slice(0, 10)
    .map((doc) => `- [${doc.category}] ${doc.name}`)
    .join('\n');

  const systemPrompt = `Voce e o concierge virtual de uma agencia de viagens. Responda de forma curta, educada e direta em portugues brasileiro.
Nunca invente dados. Use apenas as informacoes fornecidas abaixo. Se nao souber, diga que nao encontrou a informacao.

VIAGEM: ${context.trip.title}${context.trip.destination ? ` – destino: ${context.trip.destination}` : ''}
PASSAGEIRO: ${context.passengerName ?? 'desconhecido'}

ITENS DA VIAGEM:
${itemsSummary || '(nenhum item cadastrado)'}

DOCUMENTOS DISPONIVEIS:
${docsSummary || '(nenhum documento)'}`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...(input.conversationHistory ?? []),
    { role: 'user' as const, content: input.message },
  ];

  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 300,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0];
  const text = content.type === 'text' ? content.text : 'Desculpe, nao consegui processar sua pergunta.';

  const documents = findRelevantDocuments(context, input.message);

  return {
    text,
    suggestedDocuments: documents,
    shouldAutoSendSuggestedDocument: isDocumentSendIntent(normalizeText(input.message)) && documents.length > 0,
    source: documents.length ? 'documents' : 'structured',
  };
}

export async function generateConciergeReply(input: {
  message: string;
  tripId: string;
  passengerId?: string | null;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const useAI = process.env.CONCIERGE_MODE !== 'mock' && !!process.env.ANTHROPIC_API_KEY;

  if (useAI) {
    try {
      const reply = await generateConciergeAIReply(input);
      return reply.text;
    } catch (err) {
      console.error('[concierge] Erro na chamada Claude, usando fallback mock:', err);
    }
  }

  const reply = await generateConciergeMockReply(input);
  return reply.text;
}
