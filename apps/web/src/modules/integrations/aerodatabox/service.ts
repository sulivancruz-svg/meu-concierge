import { AlertSeverity, FlightStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { mergeOperationMetadata, readOperationMetadata } from '@/modules/trips/operations';

type FlightMonitoringMeta = {
  monitoringProvider?: 'AERODATABOX';
  monitoringMode?: 'mock' | 'configured';
  monitoringSubscriptionId?: string;
  monitoredFlightNumber?: string;
  webhookEnabled?: boolean;
  lastWebhookEventAt?: string;
};

function getAeroDataBoxEnv() {
  return {
    apiKey: process.env.AERODATABOX_API_KEY || '',
    apiBaseUrl: process.env.AERODATABOX_API_BASE_URL || 'https://aerodatabox.p.rapidapi.com',
    webhookSecret: process.env.AERODATABOX_WEBHOOK_SECRET || '',
    webhookUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/aerodatabox`,
  };
}

export function readFlightMonitoringMeta(value: Prisma.JsonValue | null | undefined): FlightMonitoringMeta {
  return readOperationMetadata<FlightMonitoringMeta>(value);
}

function buildMonitoredFlightNumber(input: {
  airline: string;
  flightNumber: string;
}) {
  return `${input.airline}${input.flightNumber}`.replace(/\s+/g, '').toUpperCase();
}

export async function registerAeroDataBoxSubscription(flightId: string) {
  const flight = await prisma.flightSegment.findUnique({
    where: { id: flightId },
    select: {
      id: true,
      airline: true,
      flightNumber: true,
      structuredMetadata: true,
    },
  });

  if (!flight) {
    throw new Error('FLIGHT_NOT_FOUND');
  }

  const env = getAeroDataBoxEnv();
  const monitoredFlightNumber = buildMonitoredFlightNumber({
    airline: flight.airline,
    flightNumber: flight.flightNumber,
  });

  const monitoringMeta = mergeOperationMetadata(flight.structuredMetadata, {
    monitoringProvider: 'AERODATABOX',
    monitoringMode: env.apiKey ? 'configured' : 'mock',
    monitoringSubscriptionId: env.apiKey ? `aerodatabox-${flight.id}` : `mock-aerodatabox-${flight.id}`,
    monitoredFlightNumber,
    webhookEnabled: true,
  });

  const updated = await prisma.flightSegment.update({
    where: { id: flight.id },
    data: {
      structuredMetadata: monitoringMeta,
    },
  });

  return {
    flight: updated,
    monitoredFlightNumber,
    provider: 'AERODATABOX' as const,
    mode: env.apiKey ? 'configured' as const : 'mock' as const,
    webhookUrl: env.webhookUrl,
  };
}

function mapAeroDataBoxStatus(status: string | null | undefined): FlightStatus {
  switch ((status || '').toUpperCase()) {
    case 'SCHEDULED':
      return 'SCHEDULED';
    case 'ON_TIME':
      return 'ON_TIME';
    case 'DELAYED':
      return 'DELAYED';
    case 'DEPARTED':
      return 'DEPARTED';
    case 'LANDED':
    case 'ARRIVED':
      return 'LANDED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'DIVERTED':
      return 'DIVERTED';
    default:
      return 'UNKNOWN';
  }
}

export async function appendFlightStatusSnapshot(input: {
  flightId: string;
  provider: string;
  externalStatus: string | null | undefined;
  summary?: string | null;
  payload?: Prisma.InputJsonValue;
  observedAt?: Date;
  actualDepartureAt?: Date | null;
  actualArrivalAt?: Date | null;
  departureTerminal?: string | null;
  departureGate?: string | null;
  arrivalTerminal?: string | null;
  arrivalGate?: string | null;
}) {
  const flight = await prisma.flightSegment.findUnique({
    where: { id: input.flightId },
    select: {
      id: true,
      tripId: true,
      airline: true,
      airlineName: true,
      flightNumber: true,
      origin: true,
      destination: true,
      statusCode: true,
      actualDepartureAt: true,
      actualArrivalAt: true,
      departureTerminal: true,
      departureGate: true,
      arrivalTerminal: true,
      arrivalGate: true,
      structuredMetadata: true,
    },
  });

  if (!flight) {
    throw new Error('FLIGHT_NOT_FOUND');
  }

  const statusCode = mapAeroDataBoxStatus(input.externalStatus);
  const observedAt = input.observedAt ?? new Date();
  const mergedMeta = mergeOperationMetadata(flight.structuredMetadata, {
    lastWebhookEventAt: observedAt.toISOString(),
  });
  const departureGateChanged = Boolean(input.departureGate && input.departureGate !== flight.departureGate);
  const departureTerminalChanged = Boolean(input.departureTerminal && input.departureTerminal !== flight.departureTerminal);
  const previousStatus = flight.statusCode;

  await prisma.$transaction([
    prisma.flightSegment.update({
      where: { id: flight.id },
      data: {
        statusCode,
        actualDepartureAt: input.actualDepartureAt ?? flight.actualDepartureAt,
        actualArrivalAt: input.actualArrivalAt ?? flight.actualArrivalAt,
        departureTerminal: input.departureTerminal ?? flight.departureTerminal,
        departureGate: input.departureGate ?? flight.departureGate,
        arrivalTerminal: input.arrivalTerminal ?? flight.arrivalTerminal,
        arrivalGate: input.arrivalGate ?? flight.arrivalGate,
        lastCheckedAt: observedAt,
        structuredMetadata: mergedMeta,
      },
    }),
    prisma.flightStatusHistory.create({
      data: {
        flightId: flight.id,
        statusCode,
        provider: input.provider,
        summary: input.summary ?? null,
        payload: input.payload,
        observedAt,
      },
    }),
  ]);

  const flightLabel = `${flight.airlineName || flight.airline} ${flight.flightNumber}`.trim();
  const flightRoute = `${flight.origin} para ${flight.destination}`;

  if (statusCode === 'DELAYED' && previousStatus !== 'DELAYED') {
    await prisma.alert.create({
      data: {
        agencyId: (await prisma.trip.findUnique({
          where: { id: flight.tripId },
          select: { agencyId: true },
        }))?.agencyId ?? '',
        tripId: flight.tripId,
        flightSegmentId: flight.id,
        type: 'FLIGHT_DELAY',
        severity: 'WARNING',
        title: `Atraso detectado em ${flightLabel}`,
        body: input.summary || `O voo ${flightLabel}, ${flightRoute}, foi marcado como atrasado no monitoramento.`,
        data: {
          provider: input.provider,
          statusCode,
          observedAt: observedAt.toISOString(),
        },
      },
    });
  }

  if (statusCode === 'CANCELLED' && previousStatus !== 'CANCELLED') {
    await prisma.alert.create({
      data: {
        agencyId: (await prisma.trip.findUnique({
          where: { id: flight.tripId },
          select: { agencyId: true },
        }))?.agencyId ?? '',
        tripId: flight.tripId,
        flightSegmentId: flight.id,
        type: 'FLIGHT_CANCELLATION',
        severity: 'CRITICAL',
        title: `Cancelamento detectado em ${flightLabel}`,
        body: input.summary || `O voo ${flightLabel}, ${flightRoute}, foi marcado como cancelado no monitoramento.`,
        data: {
          provider: input.provider,
          statusCode,
          observedAt: observedAt.toISOString(),
        },
      },
    });
  }

  if (departureGateChanged || departureTerminalChanged) {
    await prisma.alert.create({
      data: {
        agencyId: (await prisma.trip.findUnique({
          where: { id: flight.tripId },
          select: { agencyId: true },
        }))?.agencyId ?? '',
        tripId: flight.tripId,
        flightSegmentId: flight.id,
        type: 'FLIGHT_GATE_CHANGE',
        severity: AlertSeverity.INFO,
        title: `Atualizacao de embarque em ${flightLabel}`,
        body: [
          departureTerminalChanged ? `Terminal ${input.departureTerminal}` : null,
          departureGateChanged ? `Portao ${input.departureGate}` : null,
        ].filter(Boolean).join(' · '),
        data: {
          provider: input.provider,
          previousGate: flight.departureGate,
          newGate: input.departureGate ?? null,
          previousTerminal: flight.departureTerminal,
          newTerminal: input.departureTerminal ?? null,
          observedAt: observedAt.toISOString(),
        },
      },
    });
  }

  return statusCode;
}

function parseWebhookDate(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function verifyAeroDataBoxWebhook(secretHeader: string | null) {
  const { webhookSecret } = getAeroDataBoxEnv();
  if (!webhookSecret) {
    return true;
  }

  return Boolean(secretHeader && secretHeader === webhookSecret);
}

async function resolveFlightFromWebhook(payload: Record<string, unknown>) {
  const explicitFlightId = typeof payload.flightId === 'string' ? payload.flightId : null;
  if (explicitFlightId) {
    const flight = await prisma.flightSegment.findUnique({ where: { id: explicitFlightId } });
    if (flight) {
      return flight;
    }
  }

  const monitoredFlightNumber = typeof payload.flightNumber === 'string'
    ? payload.flightNumber.replace(/\s+/g, '').toUpperCase()
    : null;

  if (!monitoredFlightNumber) {
    return null;
  }

  const candidates = await prisma.flightSegment.findMany({
    orderBy: { departureAt: 'desc' },
    take: 50,
  });

  return candidates.find((candidate) => {
    const meta = readFlightMonitoringMeta(candidate.structuredMetadata);
    return meta.monitoredFlightNumber === monitoredFlightNumber || buildMonitoredFlightNumber({
      airline: candidate.airline,
      flightNumber: candidate.flightNumber,
    }) === monitoredFlightNumber;
  }) ?? null;
}

export async function handleAeroDataBoxWebhook(payload: Record<string, unknown>) {
  const events = Array.isArray(payload.events)
    ? payload.events as Array<Record<string, unknown>>
    : [payload];

  const applied: string[] = [];

  for (const event of events) {
    const flight = await resolveFlightFromWebhook(event);
    if (!flight) {
      continue;
    }

    const observedAt = parseWebhookDate(event.observedAt) ?? new Date();
    const summary = typeof event.summary === 'string'
      ? event.summary
      : typeof event.message === 'string'
        ? event.message
        : 'Atualizacao recebida do monitoramento de voo.';

    await appendFlightStatusSnapshot({
      flightId: flight.id,
      provider: 'AERODATABOX',
      externalStatus: typeof event.status === 'string' ? event.status : null,
      summary,
      payload: event as Prisma.InputJsonValue,
      observedAt,
      actualDepartureAt: parseWebhookDate(event.actualDepartureAt),
      actualArrivalAt: parseWebhookDate(event.actualArrivalAt),
      departureTerminal: typeof event.departureTerminal === 'string' ? event.departureTerminal : null,
      departureGate: typeof event.departureGate === 'string' ? event.departureGate : null,
      arrivalTerminal: typeof event.arrivalTerminal === 'string' ? event.arrivalTerminal : null,
      arrivalGate: typeof event.arrivalGate === 'string' ? event.arrivalGate : null,
    });

    applied.push(flight.id);
  }

  return applied;
}
