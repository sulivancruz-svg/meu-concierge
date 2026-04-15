import type { DocumentCategory, Prisma } from '@prisma/client';

export type DocumentCategoryKey =
  | 'boarding_pass'
  | 'hotel_voucher'
  | 'transport_voucher'
  | 'car_rental_voucher'
  | 'tour_voucher'
  | 'train_ticket'
  | 'insurance'
  | 'itinerary'
  | 'passport_copy'
  | 'visa'
  | 'other';

export type LinkedEntityType =
  | 'trip_item'
  | 'flight'
  | 'hotel'
  | 'transport'
  | 'tour'
  | 'train'
  | 'insurance'
  | 'trip';

type CategoryDefinition = {
  key: DocumentCategoryKey;
  label: string;
  prismaCategory: DocumentCategory;
};

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  { key: 'boarding_pass', label: 'Boarding pass', prismaCategory: 'FLIGHT' },
  { key: 'hotel_voucher', label: 'Hotel voucher', prismaCategory: 'HOTEL' },
  { key: 'transport_voucher', label: 'Transport voucher', prismaCategory: 'TRANSFER' },
  { key: 'car_rental_voucher', label: 'Car rental voucher', prismaCategory: 'TRANSFER' },
  { key: 'tour_voucher', label: 'Tour voucher', prismaCategory: 'TOUR' },
  { key: 'train_ticket', label: 'Train ticket', prismaCategory: 'TRAIN' },
  { key: 'insurance', label: 'Insurance', prismaCategory: 'INSURANCE' },
  { key: 'itinerary', label: 'Itinerary', prismaCategory: 'VOUCHER' },
  { key: 'passport_copy', label: 'Passport copy', prismaCategory: 'PASSPORT' },
  { key: 'visa', label: 'Visa', prismaCategory: 'VISA' },
  { key: 'other', label: 'Other', prismaCategory: 'OTHER' },
];

export const DOCUMENT_CATEGORY_OPTIONS = CATEGORY_DEFINITIONS.map(({ key, label }) => ({ key, label }));

export function getDocumentCategoryDefinition(key: DocumentCategoryKey) {
  return CATEGORY_DEFINITIONS.find((item) => item.key === key) ?? CATEGORY_DEFINITIONS[CATEGORY_DEFINITIONS.length - 1];
}

export function getDocumentCategoryLabel(key: string | null | undefined) {
  if (!key) {
    return 'Other';
  }

  return CATEGORY_DEFINITIONS.find((item) => item.key === key)?.label ?? key;
}

type DocumentMetadata = {
  categoryKey?: DocumentCategoryKey;
  originalFilename?: string;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string;
  linkedEntityLabel?: string;
};

export function readDocumentMetadata(value: Prisma.JsonValue | null | undefined): DocumentMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;

  return {
    categoryKey: typeof record.categoryKey === 'string' ? (record.categoryKey as DocumentCategoryKey) : undefined,
    originalFilename: typeof record.originalFilename === 'string' ? record.originalFilename : undefined,
    linkedEntityType: typeof record.linkedEntityType === 'string' ? (record.linkedEntityType as LinkedEntityType) : undefined,
    linkedEntityId: typeof record.linkedEntityId === 'string' ? record.linkedEntityId : undefined,
    linkedEntityLabel: typeof record.linkedEntityLabel === 'string' ? record.linkedEntityLabel : undefined,
  };
}

export function mergeDocumentMetadata(
  current: Prisma.JsonValue | null | undefined,
  patch: Record<string, Prisma.InputJsonValue | null | undefined>,
) {
  const base = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as Record<string, Prisma.InputJsonValue | null>) }
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

export function isPreviewableMimeType(mimeType: string) {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}
