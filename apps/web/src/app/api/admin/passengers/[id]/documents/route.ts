import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSupabaseEnv } from '@/lib/supabase/config';
import {
  buildPersonalDocumentStoragePath,
  createSignedDownloadUrl,
  createSignedUploadUrl,
} from '@/lib/storage';
import {
  DOCUMENT_CATEGORY_OPTIONS,
  getDocumentCategoryDefinition,
  getDocumentCategoryLabel,
  isPreviewableMimeType,
  mergeDocumentMetadata,
  readDocumentMetadata,
  type DocumentCategoryKey,
} from '@/modules/documents/document-meta';

const UploadRequestSchema = z.object({
  title: z.string().min(1),
  originalFilename: z.string().min(1),
  category: z.enum(DOCUMENT_CATEGORY_OPTIONS.map((o) => o.key) as [DocumentCategoryKey, ...DocumentCategoryKey[]]),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive(),
});

async function serializeDocument(document: {
  id: string;
  name: string;
  category: Prisma.JsonValue | string;
  mimeType: string;
  fileSizeBytes: number;
  extractedText: string | null;
  processingStatus: string;
  storagePath: string;
  createdAt: Date;
  structuredMetadata: Prisma.JsonValue | null;
  uploadedBy?: { name: string } | null;
}) {
  const meta = readDocumentMetadata(document.structuredMetadata);
  const signedUrl = await createSignedDownloadUrl(document.storagePath).catch(() => null);

  return {
    id: document.id,
    passengerId: null,
    passengerName: null,
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
    linkedEntityType: null,
    linkedEntityId: null,
    linkedEntityLabel: null,
    processingStatus: document.processingStatus,
    fileSizeBytes: document.fileSizeBytes,
    createdAt: document.createdAt,
    uploadedBy: document.uploadedBy?.name ?? null,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();

    const passenger = await prisma.passenger.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId, deletedAt: null },
      select: { id: true },
    });

    if (!passenger) {
      return NextResponse.json({ error: 'Passageiro não encontrado' }, { status: 404 });
    }

    const docs = await prisma.document.findMany({
      where: {
        passengerId: params.id,
        tripId: null,
        agencyId: session.user.agencyId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { name: true } } },
    });

    return NextResponse.json(await Promise.all(docs.map((doc) => serializeDocument(doc))));
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();

    const passenger = await prisma.passenger.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId, deletedAt: null },
      select: { id: true },
    });

    if (!passenger) {
      return NextResponse.json({ error: 'Passageiro não encontrado' }, { status: 404 });
    }

    const body = UploadRequestSchema.parse(await req.json());
    const documentId = crypto.randomUUID();
    const categoryDef = getDocumentCategoryDefinition(body.category);
    const storagePath = buildPersonalDocumentStoragePath({
      agencyId: session.user.agencyId,
      passengerId: params.id,
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
        tripId: null,
        passengerId: params.id,
        uploadedById: session.user.id,
        name: body.title.trim(),
        description: null,
        category: categoryDef.prismaCategory,
        mimeType: body.mimeType,
        fileSizeBytes: body.fileSizeBytes,
        storagePath,
        storageBucket: getSupabaseEnv().storageBucket,
        processingStatus: 'PENDING',
        structuredMetadata: mergeDocumentMetadata(undefined, {
          categoryKey: body.category,
          originalFilename: body.originalFilename,
        }),
      },
      include: { uploadedBy: { select: { name: true } } },
    });

    return NextResponse.json(
      { document: await serializeDocument(document), uploadUrl, mockedUpload },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
