import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSupabaseEnv } from '@/lib/supabase/config';
import { buildDocumentStoragePath, createSignedDownloadUrl, createSignedUploadUrl } from '@/lib/storage';
import {
  DOCUMENT_CATEGORY_OPTIONS,
  getDocumentCategoryDefinition,
  getDocumentCategoryLabel,
  isPreviewableMimeType,
  LinkedEntityType,
  mergeDocumentMetadata,
  readDocumentMetadata,
  type DocumentCategoryKey,
} from '@/modules/documents/document-meta';

const UploadRequestSchema = z.object({
  title: z.string().min(1),
  originalFilename: z.string().min(1),
  category: z.enum(DOCUMENT_CATEGORY_OPTIONS.map((option) => option.key) as [DocumentCategoryKey, ...DocumentCategoryKey[]]),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive(),
  passengerId: z.string().optional().or(z.literal('')),
  linkedEntityType: z.enum(['trip_item', 'flight', 'hotel', 'transport', 'tour', 'train', 'insurance', 'trip']).optional().or(z.literal('')),
  linkedEntityId: z.string().optional().or(z.literal('')),
  extractedText: z.string().optional().or(z.literal('')),
  structuredMetadata: z.record(z.string(), z.any()).optional(),
});

async function getTripOrThrow(tripId: string, agencyId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, agencyId },
  });

  if (!trip) {
    throw new Error('TRIP_NOT_FOUND');
  }

  return trip;
}

async function ensurePassengerBelongsToTrip(tripId: string, agencyId: string, passengerId?: string | null) {
  if (!passengerId) {
    return null;
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

  return passenger;
}

async function resolveLinkedEntity(tripId: string, linkedEntityType?: string | null, linkedEntityId?: string | null) {
  if (!linkedEntityType || !linkedEntityId) {
    return null;
  }

  const entityReaders: Record<LinkedEntityType, () => Promise<{ id: string; label: string } | null>> = {
    trip_item: async () => {
      const item = await prisma.tripItem.findFirst({
        where: { id: linkedEntityId, tripId },
        select: { id: true, title: true },
      });
      return item ? { id: item.id, label: item.title } : null;
    },
    trip: async () => {
      if (linkedEntityId !== tripId) {
        return null;
      }
      const trip = await prisma.trip.findFirst({
        where: { id: tripId },
        select: { id: true, title: true },
      });
      return trip ? { id: trip.id, label: trip.title } : null;
    },
    flight: async () => {
      const item = await prisma.flightSegment.findFirst({
        where: { id: linkedEntityId, tripId },
        select: { id: true, airlineName: true, airline: true, flightNumber: true },
      });
      return item ? { id: item.id, label: `${item.airlineName || item.airline} ${item.flightNumber}` } : null;
    },
    hotel: async () => {
      const item = await prisma.hotelBooking.findFirst({
        where: { id: linkedEntityId, tripId },
        select: { id: true, hotelName: true },
      });
      return item ? { id: item.id, label: item.hotelName } : null;
    },
    transport: async () => {
      const item = await prisma.transportBooking.findFirst({
        where: { id: linkedEntityId, tripId },
        select: { id: true, name: true, provider: true },
      });
      return item ? { id: item.id, label: item.provider || item.name } : null;
    },
    tour: async () => {
      const item = await prisma.tourBooking.findFirst({
        where: { id: linkedEntityId, tripId },
        select: { id: true, name: true },
      });
      return item ? { id: item.id, label: item.name } : null;
    },
    train: async () => {
      const item = await prisma.trainBooking.findFirst({
        where: { id: linkedEntityId, tripId },
        select: { id: true, operator: true, trainNumber: true },
      });
      return item ? { id: item.id, label: `${item.operator}${item.trainNumber ? ` ${item.trainNumber}` : ''}` } : null;
    },
    insurance: async () => {
      const item = await prisma.insurancePolicy.findFirst({
        where: { id: linkedEntityId, tripId },
        select: { id: true, provider: true, policyNumber: true },
      });
      return item ? { id: item.id, label: `${item.provider}${item.policyNumber ? ` ${item.policyNumber}` : ''}` } : null;
    },
  };

  const reader = entityReaders[linkedEntityType as LinkedEntityType];
  if (!reader) {
    throw new Error('LINKED_ENTITY_NOT_FOUND');
  }

  const entity = await reader();
  if (!entity) {
    throw new Error('LINKED_ENTITY_NOT_FOUND');
  }

    return {
      type: linkedEntityType,
      id: entity.id,
      label: entity.label,
    };
}

async function serializeDocument(document: {
  id: string;
  name: string;
  category: Prisma.JsonValue | string;
  description: string | null;
  mimeType: string;
  fileSizeBytes: number;
  extractedText: string | null;
  processingStatus: string;
  storagePath: string;
  createdAt: Date;
  structuredMetadata: Prisma.JsonValue | null;
  passenger?: { id: string; name: string } | null;
  uploadedBy?: { name: string } | null;
}) {
  const meta = readDocumentMetadata(document.structuredMetadata);
  const signedUrl = await createSignedDownloadUrl(document.storagePath).catch(() => null);

  return {
    id: document.id,
    tripId: undefined,
    passengerId: document.passenger?.id ?? null,
    passengerName: document.passenger?.name ?? null,
    category: meta.categoryKey ?? 'other',
    categoryLabel: getDocumentCategoryLabel(meta.categoryKey),
    title: document.name,
    originalFilename: meta.originalFilename ?? document.name,
    fileUrl: signedUrl,
    previewUrl: isPreviewableMimeType(document.mimeType) ? signedUrl : null,
    downloadUrl: signedUrl,
    mimeType: document.mimeType,
    extractedText: document.extractedText,
    structuredMetadata: document.structuredMetadata,
    linkedEntityType: meta.linkedEntityType ?? null,
    linkedEntityId: meta.linkedEntityId ?? null,
    linkedEntityLabel: meta.linkedEntityLabel ?? null,
    processingStatus: document.processingStatus,
    fileSizeBytes: document.fileSizeBytes,
    description: document.description,
    createdAt: document.createdAt,
    uploadedBy: document.uploadedBy?.name ?? null,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);

    const docs = await prisma.document.findMany({
      where: { tripId: params.id, agencyId: session.user.agencyId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        passenger: { select: { id: true, name: true } },
        uploadedBy: { select: { name: true } },
      },
    });

    return NextResponse.json(await Promise.all(docs.map((doc) => serializeDocument(doc))));
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') {
      return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);

    const body = UploadRequestSchema.parse(await req.json());
    const passenger = await ensurePassengerBelongsToTrip(params.id, session.user.agencyId, body.passengerId);
    const linkedEntity = await resolveLinkedEntity(params.id, body.linkedEntityType || null, body.linkedEntityId || null);
    const documentId = crypto.randomUUID();
    const categoryDef = getDocumentCategoryDefinition(body.category);
    const storagePath = buildDocumentStoragePath({
      agencyId: session.user.agencyId,
      tripId: params.id,
      documentId,
      categoryKey: body.category,
      fileName: body.originalFilename,
    });

    let uploadUrl: string | null = null;
    let mockedUpload = false;
    try {
      uploadUrl = await createSignedUploadUrl(storagePath);
    } catch {
      mockedUpload = true;
    }
    const document = await prisma.document.create({
      data: {
        id: documentId,
        agencyId: session.user.agencyId,
        tripId: params.id,
        passengerId: passenger?.id ?? null,
        tripItemId: linkedEntity?.type === 'trip_item' ? linkedEntity.id : null,
        uploadedById: session.user.id,
        name: body.title.trim(),
        description: null,
        category: categoryDef.prismaCategory,
        mimeType: body.mimeType,
        fileSizeBytes: body.fileSizeBytes,
        storagePath,
        storageBucket: getSupabaseEnv().storageBucket,
        extractedText: body.extractedText?.trim() || null,
        processingStatus: 'PENDING',
        structuredMetadata: mergeDocumentMetadata(body.structuredMetadata as Prisma.JsonValue | undefined, {
          categoryKey: body.category,
          originalFilename: body.originalFilename,
          linkedEntityType: linkedEntity?.type ?? null,
          linkedEntityId: linkedEntity?.id ?? null,
          linkedEntityLabel: linkedEntity?.label ?? null,
        }),
      },
      include: {
        passenger: { select: { id: true, name: true } },
        uploadedBy: { select: { name: true } },
      },
    });

    return NextResponse.json(
      {
        document: await serializeDocument(document),
        uploadUrl,
        mockedUpload,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') {
      return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'PASSENGER_NOT_FOUND') {
      return NextResponse.json({ error: 'Passageiro nao encontrado' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'LINKED_ENTITY_NOT_FOUND') {
      return NextResponse.json({ error: 'Item operacional nao encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
