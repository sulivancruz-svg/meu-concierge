import type { Prisma } from '@prisma/client';
import { createSignedDownloadUrl } from '@/lib/storage';
import { getDocumentCategoryLabel, isPreviewableMimeType, readDocumentMetadata } from './document-meta';

type BaseDocumentRecord = {
  id: string;
  passengerId: string | null;
  name: string;
  isEssential: boolean;
  mimeType: string;
  createdAt: Date;
  description: string | null;
  processingStatus: string;
  fileSizeBytes: number;
  extractedText: string | null;
  structuredMetadata: Prisma.JsonValue | null;
  storagePath: string;
};

export type SerializedTripDocument = {
  id: string;
  passengerId: string | null;
  isEssential: boolean;
  category: string;
  categoryLabel: string;
  title: string;
  originalFilename: string;
  downloadUrl: string | null;
  previewUrl: string | null;
  mimeType: string;
  extractedText: string | null;
  structuredMetadata: Record<string, unknown> | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  linkedEntityLabel: string | null;
  processingStatus: string;
  fileSizeBytes: number;
  description: string | null;
  createdAt: string;
};

export async function serializeTripDocuments(documents: BaseDocumentRecord[]): Promise<SerializedTripDocument[]> {
  return Promise.all(
    documents.map(async (document) => {
      const meta = readDocumentMetadata(document.structuredMetadata);
      let downloadUrl: string | null = null;
      if (document.storagePath) {
        try {
          downloadUrl = await createSignedDownloadUrl(document.storagePath);
        } catch {
          downloadUrl = null;
        }
      }
      const previewUrl = downloadUrl && isPreviewableMimeType(document.mimeType) ? downloadUrl : null;

      return {
        id: document.id,
        passengerId: document.passengerId,
        isEssential: document.isEssential,
        category: meta.categoryKey ?? 'other',
        categoryLabel: getDocumentCategoryLabel(meta.categoryKey),
        title: document.name,
        originalFilename: meta.originalFilename ?? document.name,
        downloadUrl,
        previewUrl,
        mimeType: document.mimeType,
        extractedText: document.extractedText,
        structuredMetadata: document.structuredMetadata as Record<string, unknown> | null,
        linkedEntityType: meta.linkedEntityType ?? null,
        linkedEntityId: meta.linkedEntityId ?? null,
        linkedEntityLabel: meta.linkedEntityLabel ?? null,
        processingStatus: document.processingStatus,
        fileSizeBytes: document.fileSizeBytes,
        description: document.description,
        createdAt: document.createdAt.toISOString(),
      };
    }),
  );
}
