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

export const TRIP_STATUS_OPTIONS: Array<{ value: TripStatus; label: string }> = [
  { value: 'DRAFT', label: 'Rascunho' },
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
