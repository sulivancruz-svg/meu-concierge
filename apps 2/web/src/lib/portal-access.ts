import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from './supabase/server';
import { prisma } from './db';

type PortalTokenType = 'access' | 'session';

interface PortalTokenPayload {
  tripId: string;
  passengerId: string;
  exp: number;
  type: PortalTokenType;
}

export const PASSENGER_PORTAL_COOKIE = 'mc_passenger_portal';

function getPortalSecret() {
  return process.env.PASSENGER_PORTAL_SECRET || 'local-portal-secret';
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

function fromBase64Url<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf-8')) as T;
  } catch {
    return null;
  }
}

function signValue(value: string) {
  return crypto.createHmac('sha256', getPortalSecret()).update(value).digest('base64url');
}

function createSignedPortalToken(input: {
  tripId: string;
  passengerId: string;
  exp: number;
  type: PortalTokenType;
}) {
  const payload: PortalTokenPayload = {
    tripId: input.tripId,
    passengerId: input.passengerId,
    exp: input.exp,
    type: input.type,
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encoded);
  return `${encoded}.${signature}`;
}

function verifySignedPortalToken(token: string, expectedType?: PortalTokenType): PortalTokenPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = signValue(encoded);
  if (signature !== expectedSignature) {
    return null;
  }

  const payload = fromBase64Url<PortalTokenPayload>(encoded);
  if (!payload) {
    return null;
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (expectedType && payload.type !== expectedType) {
    return null;
  }

  return payload;
}

export function createPassengerPortalToken(input: {
  tripId: string;
  passengerId: string;
  expiresInDays?: number;
}) {
  return createSignedPortalToken({
    tripId: input.tripId,
    passengerId: input.passengerId,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInDays ?? 30) * 24 * 60 * 60,
    type: 'access',
  });
}

export function createPassengerPortalSessionToken(input: {
  tripId: string;
  passengerId: string;
  expiresInHours?: number;
}) {
  return createSignedPortalToken({
    tripId: input.tripId,
    passengerId: input.passengerId,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInHours ?? 24 * 7) * 60 * 60,
    type: 'session',
  });
}

export function verifyPassengerPortalToken(token: string) {
  return verifySignedPortalToken(token, 'access');
}

export function verifyPassengerPortalSessionToken(token: string) {
  return verifySignedPortalToken(token, 'session');
}

export function buildPassengerPortalEntryUrl(input: {
  tripId: string;
  passengerId: string;
  expiresInDays?: number;
}) {
  return `/portal/access?token=${createPassengerPortalToken(input)}`;
}

async function resolvePortalAccessFromPassengerAuth(preferredTripId?: string) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const passenger = await prisma.passenger.findFirst({
      where: {
        authUserId: user.id,
        deletedAt: null,
        portalStatus: { not: 'SUSPENDED' },
      },
      select: {
        id: true,
      },
    });

    if (!passenger) {
      return null;
    }

    const membership = await prisma.tripPassenger.findFirst({
      where: {
        passengerId: passenger.id,
        trip: {
          ...(preferredTripId ? { id: preferredTripId } : { status: { in: ['READY', 'IN_PROGRESS', 'COMPLETED'] } }),
        },
      },
      orderBy: [
        { trip: { startDate: 'asc' } },
      ],
      select: {
        tripId: true,
      },
    });

    if (!membership) {
      return null;
    }

    return {
      tripId: membership.tripId,
      passengerId: passenger.id,
      source: 'auth' as const,
    };
  } catch {
    return null;
  }
}

export async function resolvePassengerPortalAccess(options?: {
  accessToken?: string;
  preferredTripId?: string;
}) {
  if (options?.accessToken) {
    const payload = verifyPassengerPortalToken(options.accessToken);
    if (payload) {
      return {
        tripId: payload.tripId,
        passengerId: payload.passengerId,
        source: 'token' as const,
      };
    }
  }

  const cookieStore = cookies();
  const sessionToken = cookieStore.get(PASSENGER_PORTAL_COOKIE)?.value;
  if (sessionToken) {
    const payload = verifyPassengerPortalSessionToken(sessionToken);
    if (payload) {
      return {
        tripId: payload.tripId,
        passengerId: payload.passengerId,
        source: 'session' as const,
      };
    }
  }

  return resolvePortalAccessFromPassengerAuth(options?.preferredTripId);
}
