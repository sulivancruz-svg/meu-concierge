import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { createSignedDownloadUrl } from '@/lib/storage';
import { getDocumentCategoryLabel, readDocumentMetadata } from '@/modules/documents/document-meta';
import { selectPreferredTripForWhatsApp } from '@/modules/trips/trip-meta';
import type { ConversationDetail, ConversationListItem } from './types';

async function serializeSuggestions(payload: Prisma.JsonValue | null | undefined) {
  const suggestions = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).suggestedDocuments
    : null;

  if (!Array.isArray(suggestions) || !suggestions.length) {
    return [];
  }

  const suggestionIds = suggestions
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>).id : null))
    .filter((item): item is string => typeof item === 'string');

  if (!suggestionIds.length) {
    return [];
  }

  const documents = await prisma.document.findMany({
    where: {
      id: { in: suggestionIds },
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      storagePath: true,
      structuredMetadata: true,
    },
  });

  const map = new Map(documents.map((document) => [document.id, document]));

  return Promise.all(suggestionIds.map(async (id) => {
    const document = map.get(id);
    if (!document) {
      return null;
    }

    const meta = readDocumentMetadata(document.structuredMetadata);
    let downloadUrl: string | null = null;
    if (document.storagePath) {
      try {
        downloadUrl = await createSignedDownloadUrl(document.storagePath);
      } catch {
        downloadUrl = null;
      }
    }

    return {
      id: document.id,
      title: document.name,
      categoryLabel: getDocumentCategoryLabel(meta.categoryKey),
      downloadUrl,
    };
  })).then((items) => items.filter((item): item is NonNullable<typeof item> => Boolean(item)));
}

async function serializeMessages(messages: Array<{
  id: string;
  role: string;
  direction: string;
  channel: string;
  body: string;
  createdAt: Date;
  waStatus: string | null;
  waErrorCode: string | null;
  waErrorMsg: string | null;
  waMessageId: string | null;
  payload: Prisma.JsonValue | null;
}>) {
  return Promise.all(messages.map(async (message) => ({
    id: message.id,
    role: message.role,
    direction: message.direction,
    channel: message.channel,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    waStatus: message.waStatus,
    waErrorCode: message.waErrorCode,
    waErrorMsg: message.waErrorMsg,
    waMessageId: message.waMessageId,
    payload: message.payload as Record<string, unknown> | null,
    suggestions: await serializeSuggestions(message.payload),
  })));
}

export async function resolveConversationTripId(input: {
  agencyId: string;
  passengerId?: string | null;
  tripId?: string | null;
}) {
  if (input.tripId) {
    const trip = await prisma.trip.findFirst({
      where: {
        id: input.tripId,
        agencyId: input.agencyId,
      },
      select: { id: true },
    });

    return trip?.id ?? null;
  }

  if (!input.passengerId) {
    return null;
  }

  const memberships = await prisma.tripPassenger.findMany({
    where: {
      passengerId: input.passengerId,
      trip: {
        agencyId: input.agencyId,
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

  if (!memberships.length) {
    return null;
  }

  const preferredTrip = selectPreferredTripForWhatsApp(memberships.map((membership) => membership.trip));
  return preferredTrip?.id ?? null;
}

export async function listConversations(agencyId: string): Promise<ConversationListItem[]> {
  const conversations = await prisma.conversation.findMany({
    where: { agencyId },
    orderBy: [
      { lastMessageAt: 'desc' },
      { updatedAt: 'desc' },
    ],
    include: {
      passenger: { select: { id: true, name: true } },
      trip: { select: { id: true, title: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    passengerId: conversation.passengerId,
    passengerName: conversation.passenger?.name ?? null,
    tripId: conversation.tripId,
    tripTitle: conversation.trip?.title ?? null,
    phone: conversation.phone,
    status: conversation.status,
    contextSummary: conversation.contextSummary,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    lastMessage: conversation.messages[0]
      ? {
          body: conversation.messages[0].body,
          role: conversation.messages[0].role,
          direction: conversation.messages[0].direction,
          createdAt: conversation.messages[0].createdAt.toISOString(),
        }
      : null,
  }));
}

export async function getConversationDetail(agencyId: string, conversationId: string): Promise<ConversationDetail | null> {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      agencyId,
    },
    include: {
      passenger: { select: { id: true, name: true } },
      trip: { select: { id: true, title: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    return null;
  }

  return {
    id: conversation.id,
    passengerId: conversation.passengerId,
    passengerName: conversation.passenger?.name ?? null,
    tripId: conversation.tripId,
    tripTitle: conversation.trip?.title ?? null,
    phone: conversation.phone,
    status: conversation.status,
    contextSummary: conversation.contextSummary,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
    lastMessage: conversation.messages[conversation.messages.length - 1]
      ? {
          body: conversation.messages[conversation.messages.length - 1].body,
          role: conversation.messages[conversation.messages.length - 1].role,
          direction: conversation.messages[conversation.messages.length - 1].direction,
          createdAt: conversation.messages[conversation.messages.length - 1].createdAt.toISOString(),
        }
      : null,
    messages: await serializeMessages(conversation.messages),
  };
}
