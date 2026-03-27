import { addDays, formatDistanceToNow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AlertSeverity, AlertType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

type AlertData = {
  kind?: string;
  source?: string;
  externalKey?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  [key: string]: unknown;
};

type DesiredAlert = {
  externalKey: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  tripId?: string | null;
  flightSegmentId?: string | null;
  data?: Prisma.InputJsonValue;
};

export type AlertListItem = {
  id: string;
  title: string;
  description: string;
  typeLabel: string;
  typeKey: string;
  severity: AlertSeverity;
  status: 'resolved' | 'open';
  createdAtRelative: string;
  trip: { id: string; title: string } | null;
  relatedItemLabel: string | null;
  href: string | null;
};

function readAlertData(value: Prisma.JsonValue | null | undefined): AlertData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as AlertData;
}

export function getAlertTypeKey(alert: { type: AlertType; data: Prisma.JsonValue | null }) {
  const data = readAlertData(alert.data);
  return typeof data.kind === 'string' ? data.kind : alert.type.toLowerCase();
}

export function getAlertTypeLabel(alert: { type: AlertType; data: Prisma.JsonValue | null }) {
  switch (getAlertTypeKey(alert)) {
    case 'trip_upcoming':
      return 'Viagem proxima';
    case 'document_pending':
      return 'Pendencia documental';
    case 'action_required':
      return 'Acao necessaria';
    case 'important_note':
      return 'Observacao importante';
    case 'operational_change':
      return 'Alteracao operacional';
    case 'flight_delay':
      return 'Voo atrasado';
    case 'flight_cancellation':
      return 'Cancelamento de voo';
    case 'flight_gate_change':
      return 'Alteracao de embarque';
    default:
      return 'Alerta operacional';
  }
}

function buildConversationAlertKey(conversationId: string) {
  return `conversation:reply-needed:${conversationId}`;
}

function buildTripUpcomingAlertKey(tripId: string) {
  return `trip:upcoming:${tripId}`;
}

function buildDocumentPendingAlertKey(tripId: string) {
  return `trip:document-pending:${tripId}`;
}

function buildImportantNoteAlertKey(tripId: string) {
  return `trip:important-note:${tripId}`;
}

async function buildDesiredAlerts(agencyId: string, tripId?: string) {
  const now = new Date();
  const soonLimit = addDays(now, 7);
  const urgentLimit = addDays(now, 3);

  const [trips, conversations] = await Promise.all([
    prisma.trip.findMany({
      where: {
        agencyId,
        ...(tripId ? { id: tripId } : {}),
        status: { in: ['READY', 'IN_PROGRESS'] },
        endDate: { gte: startOfDay(addDays(now, -1)) },
      },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        status: true,
        internalNotes: true,
        documents: {
          where: { deletedAt: null },
          select: { id: true, isEssential: true },
        },
      },
      orderBy: { startDate: 'asc' },
    }),
    prisma.conversation.findMany({
      where: {
        agencyId,
        status: 'OPEN',
        ...(tripId ? { tripId } : {}),
      },
      include: {
        passenger: { select: { name: true } },
        trip: { select: { id: true, title: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
  ]);

  const desired: DesiredAlert[] = [];

  for (const trip of trips) {
    if (trip.status === 'READY' && trip.startDate <= soonLimit && trip.endDate >= now) {
      desired.push({
        externalKey: buildTripUpcomingAlertKey(trip.id),
        type: 'SYSTEM',
        severity: trip.startDate <= urgentLimit ? 'WARNING' : 'INFO',
        title: `Viagem proxima: ${trip.title}`,
        body: trip.startDate <= urgentLimit
          ? 'A jornada comeca nos proximos 3 dias e exige revisao operacional final.'
          : 'Esta viagem esta entrando na janela de preparacao operacional.',
        tripId: trip.id,
        data: {
          source: 'system-sync',
          kind: 'trip_upcoming',
          externalKey: buildTripUpcomingAlertKey(trip.id),
          relatedEntityType: 'trip',
          relatedEntityId: trip.id,
        },
      });
    }

    const essentialDocuments = trip.documents.filter((document) => document.isEssential);
    if ((trip.status === 'READY' || trip.status === 'IN_PROGRESS') && (trip.documents.length === 0 || essentialDocuments.length === 0)) {
      desired.push({
        externalKey: buildDocumentPendingAlertKey(trip.id),
        type: 'SYSTEM',
        severity: 'WARNING',
        title: `Pendencia documental em ${trip.title}`,
        body: trip.documents.length === 0
          ? 'A viagem ainda nao possui documentos carregados no hub.'
          : 'Ainda faltam documentos marcados como essenciais para esta jornada.',
        tripId: trip.id,
        data: {
          source: 'system-sync',
          kind: 'document_pending',
          externalKey: buildDocumentPendingAlertKey(trip.id),
          relatedEntityType: 'trip',
          relatedEntityId: trip.id,
        },
      });
    }

    if (trip.internalNotes?.trim()) {
      desired.push({
        externalKey: buildImportantNoteAlertKey(trip.id),
        type: 'SYSTEM',
        severity: 'INFO',
        title: `Observacao importante em ${trip.title}`,
        body: trip.internalNotes.trim().slice(0, 220),
        tripId: trip.id,
        data: {
          source: 'system-sync',
          kind: 'important_note',
          externalKey: buildImportantNoteAlertKey(trip.id),
          relatedEntityType: 'trip',
          relatedEntityId: trip.id,
        },
      });
    }
  }

  for (const conversation of conversations) {
    const lastMessage = conversation.messages[0];
    if (!lastMessage || lastMessage.direction !== 'INBOUND') {
      continue;
    }

    desired.push({
      externalKey: buildConversationAlertKey(conversation.id),
      type: 'SYSTEM',
      severity: 'WARNING',
      title: `Acao necessaria em conversa ${conversation.passenger?.name ?? conversation.phone}`,
      body: 'A ultima mensagem veio do passageiro e ainda depende de resposta da operacao.',
      tripId: conversation.tripId,
      data: {
        source: 'system-sync',
        kind: 'action_required',
        externalKey: buildConversationAlertKey(conversation.id),
        relatedEntityType: 'conversation',
        relatedEntityId: conversation.id,
      },
    });
  }

  return desired;
}

export async function syncOperationalAlertsForAgency(agencyId: string, tripId?: string) {
  const desired = await buildDesiredAlerts(agencyId, tripId);
  const desiredKeys = new Set(desired.map((item) => item.externalKey));

  const existing = await prisma.alert.findMany({
    where: {
      agencyId,
      resolvedAt: null,
      ...(tripId ? { tripId } : {}),
    },
    select: {
      id: true,
      type: true,
      severity: true,
      title: true,
      body: true,
      tripId: true,
      flightSegmentId: true,
      data: true,
    },
  });

  const managedExisting = existing.filter((alert) => readAlertData(alert.data).source === 'system-sync');
  const existingByKey = new Map(
    managedExisting
      .map((alert) => {
        const data = readAlertData(alert.data);
        return typeof data.externalKey === 'string' ? [data.externalKey, alert] as const : null;
      })
      .filter((item): item is readonly [string, typeof managedExisting[number]] => Boolean(item)),
  );

  for (const item of desired) {
    const existingAlert = existingByKey.get(item.externalKey);
    if (!existingAlert) {
      await prisma.alert.create({
        data: {
          agencyId,
          tripId: item.tripId ?? null,
          flightSegmentId: item.flightSegmentId ?? null,
          type: item.type,
          severity: item.severity,
          title: item.title,
          body: item.body,
          data: item.data,
        },
      });
      continue;
    }

    if (
      existingAlert.title !== item.title ||
      existingAlert.body !== item.body ||
      existingAlert.severity !== item.severity
    ) {
      await prisma.alert.update({
        where: { id: existingAlert.id },
        data: {
          title: item.title,
          body: item.body,
          severity: item.severity,
          tripId: item.tripId ?? null,
          flightSegmentId: item.flightSegmentId ?? null,
          data: item.data,
        },
      });
    }
  }

  for (const alert of managedExisting) {
    const data = readAlertData(alert.data);
    if (typeof data.externalKey === 'string' && !desiredKeys.has(data.externalKey)) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { resolvedAt: new Date() },
      });
    }
  }
}

export async function listAgencyAlerts(agencyId: string, options?: {
  tripId?: string;
  take?: number;
  includeResolved?: boolean;
}) {
  const alerts = await prisma.alert.findMany({
    where: {
      agencyId,
      ...(options?.tripId ? { tripId: options.tripId } : {}),
      ...(options?.includeResolved ? {} : { resolvedAt: null }),
    },
    orderBy: [
      { resolvedAt: 'asc' },
      { createdAt: 'desc' },
    ],
    take: options?.take ?? 20,
    include: {
      trip: { select: { id: true, title: true } },
      flightSegment: { select: { airlineName: true, airline: true, flightNumber: true, origin: true, destination: true } },
    },
  });

  return alerts.map((alert): AlertListItem => {
    const data = readAlertData(alert.data);
    const relatedItemLabel = alert.flightSegment
      ? `${alert.flightSegment.airlineName || alert.flightSegment.airline} ${alert.flightSegment.flightNumber} ${alert.flightSegment.origin}-${alert.flightSegment.destination}`
      : typeof data.relatedEntityType === 'string' && data.relatedEntityType === 'conversation'
        ? 'Conversa operacional'
        : null;

    return {
      id: alert.id,
      title: alert.title,
      description: alert.body,
      typeLabel: getAlertTypeLabel(alert),
      typeKey: getAlertTypeKey(alert),
      severity: alert.severity,
      status: alert.resolvedAt ? 'resolved' : 'open',
      createdAtRelative: formatDistanceToNow(alert.createdAt, { addSuffix: true, locale: ptBR }),
      trip: alert.trip ? { id: alert.trip.id, title: alert.trip.title } : null,
      relatedItemLabel,
      href: alert.trip ? `/dashboard/trips/${alert.trip.id}` : null,
    };
  });
}
