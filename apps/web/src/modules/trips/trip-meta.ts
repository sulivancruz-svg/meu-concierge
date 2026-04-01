import type { Prisma, TripStatus } from '@prisma/client';

export type TripOperationalMeta = {
  internalCode: string | null;
  activeForWhatsApp: boolean;
};

export function isTripActiveForWhatsApp(input: {
  isActiveForWhatsapp?: boolean;
  structuredMetadata?: Prisma.JsonValue | null;
}) {
  const operational = readTripOperationalMeta(input.structuredMetadata);
  return input.isActiveForWhatsapp === true || operational.activeForWhatsApp;
}

type TripCandidateForWhatsApp = {
  startDate: Date;
  endDate?: Date | null;
  status: TripStatus;
  isActiveForWhatsapp?: boolean;
  structuredMetadata?: Prisma.JsonValue | null;
};

function isTripOngoing(input: TripCandidateForWhatsApp, now: Date) {
  if (input.status === 'IN_PROGRESS') {
    return true;
  }

  const startsBeforeNow = input.startDate.getTime() <= now.getTime();
  const endsAfterNow = input.endDate ? input.endDate.getTime() >= now.getTime() : true;
  return startsBeforeNow && endsAfterNow;
}

function isTripUpcoming(input: TripCandidateForWhatsApp, now: Date) {
  return input.startDate.getTime() >= now.getTime() || (input.endDate?.getTime() ?? 0) >= now.getTime();
}

export function selectPreferredTripForWhatsApp<T extends TripCandidateForWhatsApp>(
  trips: T[],
  now = new Date(),
) {
  if (!trips.length) {
    return null;
  }

  const sorted = [...trips].sort((left, right) => {
    const leftExplicit = isTripActiveForWhatsApp(left);
    const rightExplicit = isTripActiveForWhatsApp(right);
    if (leftExplicit !== rightExplicit) {
      return leftExplicit ? -1 : 1;
    }

    const leftOngoing = isTripOngoing(left, now);
    const rightOngoing = isTripOngoing(right, now);
    if (leftOngoing !== rightOngoing) {
      return leftOngoing ? -1 : 1;
    }

    const leftUpcoming = isTripUpcoming(left, now);
    const rightUpcoming = isTripUpcoming(right, now);
    if (leftUpcoming !== rightUpcoming) {
      return leftUpcoming ? -1 : 1;
    }

    if (leftUpcoming && rightUpcoming) {
      return left.startDate.getTime() - right.startDate.getTime();
    }

    return right.startDate.getTime() - left.startDate.getTime();
  });

  return sorted[0] ?? null;
}

export const TRIP_STATUS_OPTIONS: Array<{ value: TripStatus; label: string }> = [
  { value: 'DRAFT', label: 'Pre-viagem' },
  { value: 'READY', label: 'Pronta' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'COMPLETED', label: 'Concluida' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export function getTripStatusLabel(status: TripStatus) {
  return TRIP_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function getTripStatusTone(status: TripStatus): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'READY':
      return 'info';
    case 'IN_PROGRESS':
      return 'success';
    case 'COMPLETED':
      return 'neutral';
    case 'CANCELLED':
      return 'danger';
    case 'DRAFT':
    default:
      return 'warning';
  }
}

export function readTripOperationalMeta(input: Prisma.JsonValue | null | undefined): TripOperationalMeta {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const record = value as Record<string, unknown>;
  const internalCode = typeof record.internalCode === 'string' ? record.internalCode.trim() : '';

  return {
    internalCode: internalCode || null,
    activeForWhatsApp: record.activeForWhatsApp === true,
  };
}

export function mergeTripOperationalMeta(
  current: Prisma.JsonValue | null | undefined,
  next: TripOperationalMeta,
): Prisma.InputJsonValue {
  const base = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as Record<string, unknown>) }
    : {};

  if (next.internalCode) {
    base.internalCode = next.internalCode;
  } else {
    delete base.internalCode;
  }

  if (next.activeForWhatsApp) {
    base.activeForWhatsApp = true;
  } else {
    delete base.activeForWhatsApp;
  }

  return base as Prisma.InputJsonValue;
}
