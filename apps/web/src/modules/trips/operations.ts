import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

type JsonRecord = Record<string, Prisma.InputJsonValue | null>;

export function toNullableString(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseOptionalDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('INVALID_DATE');
  }

  return parsed;
}

export function parseRequiredDate(value: string) {
  const parsed = parseOptionalDate(value);
  if (!parsed) {
    throw new Error('INVALID_DATE');
  }

  return parsed;
}

export async function getTripOrThrow(tripId: string, agencyId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, agencyId },
  });

  if (!trip) {
    throw new Error('TRIP_NOT_FOUND');
  }

  return trip;
}

export async function resolvePassengerContext(agencyId: string, passengerId?: string | null) {
  if (!passengerId) {
    return { passengerId: null, passengerName: null };
  }

  const passenger = await prisma.passenger.findFirst({
    where: {
      id: passengerId,
      agencyId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!passenger) {
    throw new Error('PASSENGER_NOT_FOUND');
  }

  return {
    passengerId: passenger.id,
    passengerName: passenger.name,
  };
}

export function mergeOperationMetadata(
  current: Prisma.JsonValue | null | undefined,
  patch: Record<string, Prisma.InputJsonValue | null | undefined>,
) {
  const base: JsonRecord = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as JsonRecord) }
    : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === '') {
      delete base[key];
    } else {
      base[key] = value;
    }
  }

  return base as Prisma.InputJsonValue;
}

export function readOperationMetadata<T extends Record<string, unknown>>(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as T;
  }

  return value as T;
}
