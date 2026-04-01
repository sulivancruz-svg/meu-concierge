import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { selectPreferredTripForWhatsApp } from '@/modules/trips/trip-meta';

const PLATFORM_OWNER_AGENCY_SLUG = (process.env.PLATFORM_OWNER_AGENCY_SLUG ?? 'sulivan-cruz').trim().toLowerCase();

type WebhookMetadata = {
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
};

export type ParsedWhatsAppTextMessage = {
  waMessageId: string;
  fromPhone: string;
  body: string;
  metadata: WebhookMetadata;
  raw: Record<string, unknown>;
};

export function normalizeWhatsAppPhone(input: string | null | undefined) {
  if (!input) {
    return '';
  }

  return input.replace(/\D+/g, '').replace(/^00/, '');
}

function buildPhoneVariants(input: string | null | undefined) {
  const normalized = normalizeWhatsAppPhone(input);
  if (!normalized) {
    return [];
  }

  const variants = new Set([normalized]);
  const withoutInternationalPrefix = normalized.replace(/^00/, '');
  variants.add(withoutInternationalPrefix);

  const brazilianCandidates = new Set<string>();
  if (withoutInternationalPrefix.startsWith('55')) {
    brazilianCandidates.add(withoutInternationalPrefix.slice(2));
  }
  brazilianCandidates.add(withoutInternationalPrefix);

  for (const candidate of Array.from(brazilianCandidates)) {
    const national = candidate.replace(/^0+/, '');
    variants.add(national);

    if (national.length >= 10) {
      variants.add(`55${national}`);
    }

    // Brasil: comparar com e sem o nono digito apos o DDD.
    if (national.length === 11 && national[2] === '9') {
      const withoutNinthDigit = `${national.slice(0, 2)}${national.slice(3)}`;
      variants.add(withoutNinthDigit);
      variants.add(`55${withoutNinthDigit}`);
    }

    if (national.length === 10) {
      const withNinthDigit = `${national.slice(0, 2)}9${national.slice(2)}`;
      variants.add(withNinthDigit);
      variants.add(`55${withNinthDigit}`);
    }
  }

  return Array.from(variants);
}

function phonesMatch(left: string | null | undefined, right: string | null | undefined) {
  const variantsLeft = buildPhoneVariants(left);
  const variantsRight = buildPhoneVariants(right);

  if (!variantsLeft.length || !variantsRight.length) {
    return false;
  }

  return variantsLeft.some((candidateLeft) => (
    variantsRight.some((candidateRight) => (
      candidateLeft === candidateRight ||
      candidateLeft.endsWith(candidateRight) ||
      candidateRight.endsWith(candidateLeft)
    ))
  ));
}

export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.WA_APP_SECRET;
  if (!appSecret) {
    return true;
  }

  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const provided = signatureHeader.replace('sha256=', '');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function parseWhatsAppTextMessages(payload: Record<string, unknown>): ParsedWhatsAppTextMessage[] {
  const entries = Array.isArray(payload.entry) ? payload.entry as Array<Record<string, unknown>> : [];
  const messages: ParsedWhatsAppTextMessage[] = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes as Array<Record<string, unknown>> : [];
    for (const change of changes) {
      const value = change.value && typeof change.value === 'object' ? change.value as Record<string, unknown> : null;
      if (!value) {
        continue;
      }

      const metadata = value.metadata && typeof value.metadata === 'object'
        ? value.metadata as Record<string, unknown>
        : {};

      const valueMessages = Array.isArray(value.messages) ? value.messages as Array<Record<string, unknown>> : [];
      for (const message of valueMessages) {
        if (message.type !== 'text') {
          continue;
        }

        const text = message.text && typeof message.text === 'object' ? message.text as Record<string, unknown> : {};
        messages.push({
          waMessageId: typeof message.id === 'string' ? message.id : '',
          fromPhone: typeof message.from === 'string' ? normalizeWhatsAppPhone(message.from) : '',
          body: typeof text.body === 'string' ? text.body : '',
          metadata: {
            phoneNumberId: typeof metadata.phone_number_id === 'string' ? metadata.phone_number_id : null,
            displayPhoneNumber: typeof metadata.display_phone_number === 'string' ? metadata.display_phone_number : null,
          },
          raw: message,
        });
      }
    }
  }

  return messages.filter((message) => message.waMessageId && message.fromPhone && message.body.trim());
}

export async function resolveAgencyFromWebhook(metadata: WebhookMetadata) {
  const agencies = await prisma.agency.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      slug: true,
      supportWhatsApp: true,
    },
  });

  if (metadata.displayPhoneNumber) {
    const matched = agencies.find((agency) => phonesMatch(agency.supportWhatsApp, metadata.displayPhoneNumber));
    if (matched) {
      return matched.id;
    }
  }

  if (metadata.phoneNumberId && process.env.WA_PHONE_NUMBER_ID && metadata.phoneNumberId === process.env.WA_PHONE_NUMBER_ID) {
    const platformAgency = agencies.find((agency) => agency.slug.toLowerCase() === PLATFORM_OWNER_AGENCY_SLUG);
    return platformAgency?.id ?? null;
  }

  return null;
}

export async function resolvePassengerFromWhatsApp(agencyId: string, phone: string) {
  const passengers = await prisma.passenger.findMany({
    where: {
      agencyId,
      deletedAt: null,
    },
    select: {
      id: true,
      phone: true,
      name: true,
    },
  });

  return passengers.find((passenger) => phonesMatch(passenger.phone, phone)) ?? null;
}

export async function resolveActiveTripForPassenger(agencyId: string, passengerId: string | null) {
  if (!passengerId) {
    return null;
  }

  const memberships = await prisma.tripPassenger.findMany({
    where: {
      passengerId,
      trip: {
        agencyId,
        status: { in: ['DRAFT', 'READY', 'IN_PROGRESS', 'COMPLETED'] },
      },
    },
    include: {
      trip: {
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          isActiveForWhatsapp: true,
          structuredMetadata: true,
        },
      },
    },
    orderBy: [
      { trip: { startDate: 'asc' } },
    ],
  });

  const preferredTrip = selectPreferredTripForWhatsApp(memberships.map((membership) => membership.trip));
  return preferredTrip?.id ?? null;
}

export async function findOrCreateWhatsAppConversation(input: {
  agencyId: string;
  phone: string;
  passengerId: string | null;
  tripId: string | null;
}) {
  const normalizedPhone = normalizeWhatsAppPhone(input.phone);
  const candidates = await prisma.conversation.findMany({
    where: {
      agencyId: input.agencyId,
      OR: [
        { phone: normalizedPhone },
        ...(input.passengerId ? [{ passengerId: input.passengerId }] : []),
      ],
    },
    orderBy: [
      { lastMessageAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 10,
  });

  const existing = candidates.find((conversation) => (
    phonesMatch(conversation.phone, normalizedPhone) &&
    ((input.tripId && conversation.tripId === input.tripId) || (!input.tripId && conversation.passengerId === input.passengerId))
  )) ?? candidates.find((conversation) => phonesMatch(conversation.phone, normalizedPhone));

  if (existing) {
    return prisma.conversation.update({
      where: { id: existing.id },
      data: {
        phone: normalizedPhone,
        passengerId: input.passengerId ?? existing.passengerId,
        tripId: input.tripId,
        lastMessageAt: new Date(),
      },
    });
  }

  return prisma.conversation.create({
    data: {
      agencyId: input.agencyId,
      phone: normalizedPhone,
      passengerId: input.passengerId,
      tripId: input.tripId,
      lastMessageAt: new Date(),
    },
  });
}
