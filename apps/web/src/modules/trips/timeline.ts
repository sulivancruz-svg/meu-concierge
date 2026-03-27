import type { Prisma } from '@prisma/client';
import { startOfDay } from 'date-fns';
import type { SerializedTripDocument } from '@/modules/documents/document-presentation';
import { readOperationMetadata } from './operations';

type TimelineFlight = {
  id: string;
  airline: string;
  airlineName: string | null;
  flightNumber: string;
  origin: string;
  destination: string;
  departureAt: Date;
  arrivalAt: Date;
  actualDepartureAt: Date | null;
  actualArrivalAt: Date | null;
  departureTerminal: string | null;
  departureGate: string | null;
  arrivalTerminal?: string | null;
  arrivalGate?: string | null;
  statusCode: string;
};

type TimelineHotel = {
  id: string;
  hotelName: string;
  address: string | null;
  checkIn: Date;
  checkOut: Date;
  confirmationCode: string | null;
  notes: string | null;
};

type TimelineTransport = {
  id: string;
  type: string;
  name: string;
  scheduledAt: Date;
  pickupPoint: string | null;
  dropoffPoint: string | null;
  provider: string | null;
  confirmationCode: string | null;
  rentalReturnAt: Date | null;
  notes: string | null;
};

type TimelineTour = {
  id: string;
  name: string;
  scheduledAt: Date;
  meetingPoint: string | null;
  provider: string | null;
  confirmationCode: string | null;
  notes: string | null;
  structuredMetadata: Prisma.JsonValue | null;
};

type TimelineTrain = {
  id: string;
  operator: string;
  trainNumber: string | null;
  origin: string;
  destination: string;
  departureAt: Date;
  arrivalAt: Date;
  confirmationCode: string | null;
  notes: string | null;
};

type TimelineInsurance = {
  id: string;
  provider: string;
  policyNumber: string | null;
  coverageType: string | null;
  startDate: Date;
  endDate: Date;
  emergencyPhone: string | null;
  notes: string | null;
};

type TimelineNote = {
  id: string;
  body: string;
  createdAt: Date;
  author?: { name: string | null } | null;
};

export type TripTimelineItem = {
  key: string;
  date: Date;
  dayKey: string;
  kind:
    | 'flight'
    | 'hotel'
    | 'transport'
    | 'car_rental'
    | 'tour'
    | 'train'
    | 'insurance'
    | 'note';
  eventType: string;
  title: string;
  location: string | null;
  summary: string | null;
  status: string | null;
  document: {
    id: string;
    title: string;
    url: string | null;
    previewUrl: string | null;
    categoryLabel: string;
  } | null;
  audience: 'all' | 'admin';
};

export type TripTimelineGroup = {
  key: string;
  date: Date;
  items: TripTimelineItem[];
};

type TripTimelineSource = {
  flightSegments: TimelineFlight[];
  hotelBookings: TimelineHotel[];
  transportBookings: TimelineTransport[];
  tourBookings: TimelineTour[];
  trainBookings: TimelineTrain[];
  insurancePolicies: TimelineInsurance[];
  notes: TimelineNote[];
  documents: SerializedTripDocument[];
};

function createDayKey(value: Date) {
  return startOfDay(value).toISOString();
}

function compactSummary(parts: Array<string | null | undefined>) {
  const filtered = parts.map((item) => item?.trim()).filter(Boolean) as string[];
  return filtered.length ? filtered.join(' · ') : null;
}

function humanizeValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function readEndAt(value: Prisma.JsonValue | null | undefined) {
  const meta = readOperationMetadata<Record<string, unknown>>(value);
  if (typeof meta.endAt !== 'string') {
    return null;
  }

  const parsed = new Date(meta.endAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pickLinkedDocument(
  documents: SerializedTripDocument[],
  linkedEntityType: string,
  linkedEntityId: string,
) {
  const exact = documents.find((document) => (
    document.linkedEntityType === linkedEntityType &&
    document.linkedEntityId === linkedEntityId
  ));

  if (!exact) {
    return null;
  }

  return {
    id: exact.id,
    title: exact.title,
    url: exact.downloadUrl,
    previewUrl: exact.previewUrl,
    categoryLabel: exact.categoryLabel,
  };
}

function toFlightLabel(segment: TimelineFlight) {
  return `${segment.airlineName || segment.airline} ${segment.flightNumber}`.trim();
}

function buildItems(source: TripTimelineSource): TripTimelineItem[] {
  const items: TripTimelineItem[] = [];

  for (const segment of source.flightSegments) {
    const document = pickLinkedDocument(source.documents, 'flight', segment.id);
    items.push({
      key: `flight-departure-${segment.id}`,
      date: segment.actualDepartureAt ?? segment.departureAt,
      dayKey: createDayKey(segment.actualDepartureAt ?? segment.departureAt),
      kind: 'flight',
      eventType: 'Voo',
      title: `${toFlightLabel(segment)} · partida`,
      location: segment.origin,
      summary: compactSummary([
        `Chegada em ${segment.destination}`,
        segment.departureTerminal ? `Terminal ${segment.departureTerminal}` : null,
        segment.departureGate ? `Portao ${segment.departureGate}` : null,
      ]),
      status: humanizeValue(segment.statusCode),
      document,
      audience: 'all',
    });
    items.push({
      key: `flight-arrival-${segment.id}`,
      date: segment.actualArrivalAt ?? segment.arrivalAt,
      dayKey: createDayKey(segment.actualArrivalAt ?? segment.arrivalAt),
      kind: 'flight',
      eventType: 'Chegada de voo',
      title: `${toFlightLabel(segment)} · chegada`,
      location: segment.destination,
      summary: compactSummary([
        `Saida de ${segment.origin}`,
        segment.arrivalTerminal ? `Terminal ${segment.arrivalTerminal}` : null,
        segment.arrivalGate ? `Portao ${segment.arrivalGate}` : null,
      ]),
      status: humanizeValue(segment.statusCode),
      document,
      audience: 'all',
    });
  }

  for (const hotel of source.hotelBookings) {
    const document = pickLinkedDocument(source.documents, 'hotel', hotel.id);
    items.push({
      key: `hotel-checkin-${hotel.id}`,
      date: hotel.checkIn,
      dayKey: createDayKey(hotel.checkIn),
      kind: 'hotel',
      eventType: 'Check-in',
      title: hotel.hotelName,
      location: hotel.address,
      summary: compactSummary([
        hotel.confirmationCode ? `Reserva ${hotel.confirmationCode}` : null,
        hotel.notes,
      ]),
      status: null,
      document,
      audience: 'all',
    });
    items.push({
      key: `hotel-checkout-${hotel.id}`,
      date: hotel.checkOut,
      dayKey: createDayKey(hotel.checkOut),
      kind: 'hotel',
      eventType: 'Check-out',
      title: hotel.hotelName,
      location: hotel.address,
      summary: hotel.confirmationCode ? `Reserva ${hotel.confirmationCode}` : null,
      status: null,
      document,
      audience: 'all',
    });
  }

  for (const transport of source.transportBookings) {
    const isCarRental = transport.type === 'CAR_RENTAL';
    const document = pickLinkedDocument(source.documents, 'transport', transport.id);
    items.push({
      key: `transport-start-${transport.id}`,
      date: transport.scheduledAt,
      dayKey: createDayKey(transport.scheduledAt),
      kind: isCarRental ? 'car_rental' : 'transport',
      eventType: isCarRental ? 'Retirada do carro' : 'Transporte',
      title: transport.name,
      location: compactSummary([transport.pickupPoint, transport.dropoffPoint ? `ate ${transport.dropoffPoint}` : null]),
      summary: compactSummary([
        transport.provider,
        transport.dropoffPoint ? `Destino ${transport.dropoffPoint}` : null,
        transport.confirmationCode ? `Reserva ${transport.confirmationCode}` : null,
        transport.notes,
      ]),
      status: isCarRental ? null : humanizeValue(transport.type),
      document,
      audience: 'all',
    });

    if (isCarRental && transport.rentalReturnAt) {
      items.push({
        key: `transport-return-${transport.id}`,
        date: transport.rentalReturnAt,
        dayKey: createDayKey(transport.rentalReturnAt),
        kind: 'car_rental',
        eventType: 'Devolucao do carro',
        title: transport.name,
        location: compactSummary([transport.dropoffPoint, transport.pickupPoint ? `origem ${transport.pickupPoint}` : null]),
        summary: compactSummary([
          transport.provider,
          transport.confirmationCode ? `Reserva ${transport.confirmationCode}` : null,
        ]),
        status: null,
        document,
        audience: 'all',
      });
    }
  }

  for (const tour of source.tourBookings) {
    const document = pickLinkedDocument(source.documents, 'tour', tour.id);
    const endAt = readEndAt(tour.structuredMetadata);
    items.push({
      key: `tour-start-${tour.id}`,
      date: tour.scheduledAt,
      dayKey: createDayKey(tour.scheduledAt),
      kind: 'tour',
      eventType: 'Passeio',
      title: tour.name,
      location: tour.meetingPoint,
      summary: compactSummary([
        tour.provider,
        tour.confirmationCode ? `Reserva ${tour.confirmationCode}` : null,
        tour.notes,
      ]),
      status: null,
      document,
      audience: 'all',
    });

    if (endAt) {
      items.push({
        key: `tour-end-${tour.id}`,
        date: endAt,
        dayKey: createDayKey(endAt),
        kind: 'tour',
        eventType: 'Fim do passeio',
        title: tour.name,
        location: tour.meetingPoint,
        summary: compactSummary([
          tour.provider,
          tour.confirmationCode ? `Reserva ${tour.confirmationCode}` : null,
        ]),
        status: null,
        document,
        audience: 'all',
      });
    }
  }

  for (const train of source.trainBookings) {
    const document = pickLinkedDocument(source.documents, 'train', train.id);
    const title = `${train.operator}${train.trainNumber ? ` ${train.trainNumber}` : ''}`.trim();
    items.push({
      key: `train-departure-${train.id}`,
      date: train.departureAt,
      dayKey: createDayKey(train.departureAt),
      kind: 'train',
      eventType: 'Trem',
      title: `${title} · embarque`,
      location: train.origin,
      summary: compactSummary([
        `Chegada em ${train.destination}`,
        train.confirmationCode ? `Reserva ${train.confirmationCode}` : null,
        train.notes,
      ]),
      status: null,
      document,
      audience: 'all',
    });
    items.push({
      key: `train-arrival-${train.id}`,
      date: train.arrivalAt,
      dayKey: createDayKey(train.arrivalAt),
      kind: 'train',
      eventType: 'Chegada de trem',
      title: `${title} · chegada`,
      location: train.destination,
      summary: compactSummary([
        `Saida de ${train.origin}`,
        train.confirmationCode ? `Reserva ${train.confirmationCode}` : null,
      ]),
      status: null,
      document,
      audience: 'all',
    });
  }

  for (const insurance of source.insurancePolicies) {
    const document = pickLinkedDocument(source.documents, 'insurance', insurance.id);
    items.push({
      key: `insurance-${insurance.id}`,
      date: insurance.startDate,
      dayKey: createDayKey(insurance.startDate),
      kind: 'insurance',
      eventType: 'Seguro',
      title: `Seguro ${insurance.provider}`,
      location: null,
      summary: compactSummary([
        insurance.coverageType,
        insurance.policyNumber ? `Apolice ${insurance.policyNumber}` : null,
        insurance.emergencyPhone ? `Emergencia ${insurance.emergencyPhone}` : null,
        insurance.notes,
      ]),
      status: `Valido ate ${insurance.endDate.toLocaleDateString('pt-BR')}`,
      document,
      audience: 'all',
    });
  }

  for (const note of source.notes) {
    items.push({
      key: `note-${note.id}`,
      date: note.createdAt,
      dayKey: createDayKey(note.createdAt),
      kind: 'note',
      eventType: 'Observacao interna',
      title: note.author?.name ? `Nota de ${note.author.name}` : 'Nota operacional',
      location: null,
      summary: note.body,
      status: null,
      document: null,
      audience: 'admin',
    });
  }

  return items.sort((left, right) => left.date.getTime() - right.date.getTime());
}

export function buildTripTimeline(
  source: TripTimelineSource,
  options?: { viewer?: 'admin' | 'passenger' },
) {
  const viewer = options?.viewer ?? 'admin';
  return buildItems(source).filter((item) => viewer === 'admin' || item.audience === 'all');
}

export function groupTripTimeline(items: TripTimelineItem[]): TripTimelineGroup[] {
  const groups = new Map<string, TripTimelineGroup>();

  for (const item of items) {
    const existing = groups.get(item.dayKey);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(item.dayKey, {
      key: item.dayKey,
      date: startOfDay(item.date),
      items: [item],
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .map((group) => ({
      ...group,
      items: group.items.sort((left, right) => left.date.getTime() - right.date.getTime()),
    }));
}

export function buildJourneyTimeline(snapshot: {
  trip: Omit<TripTimelineSource, 'documents' | 'notes'> & { notes: TimelineNote[] };
  documents: SerializedTripDocument[];
}, options?: { viewer?: 'admin' | 'passenger' }) {
  return buildTripTimeline({
    flightSegments: snapshot.trip.flightSegments,
    hotelBookings: snapshot.trip.hotelBookings,
    transportBookings: snapshot.trip.transportBookings,
    tourBookings: snapshot.trip.tourBookings,
    trainBookings: snapshot.trip.trainBookings,
    insurancePolicies: snapshot.trip.insurancePolicies,
    notes: snapshot.trip.notes,
    documents: snapshot.documents,
  }, options);
}
