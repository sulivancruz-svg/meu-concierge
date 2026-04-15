import { createSupabaseServiceRoleClient } from './supabase/server';
import { getSupabaseEnv } from './supabase/config';

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'documento.bin';
}

export function buildDocumentStoragePath(input: {
  agencyId: string;
  tripId: string;
  documentId: string;
  categoryKey: string;
  fileName: string;
}) {
  return `agency/${input.agencyId}/${input.tripId}/${input.categoryKey}/${input.documentId}-${sanitizeFileName(input.fileName)}`;
}

export function buildPersonalDocumentStoragePath(input: {
  agencyId: string;
  passengerId: string;
  documentId: string;
  categoryKey: string;
  fileName: string;
}) {
  return `agency/${input.agencyId}/passengers/${input.passengerId}/${input.categoryKey}/${input.documentId}-${sanitizeFileName(input.fileName)}`;
}

export async function createSignedUploadUrl(path: string) {
  const supabase = createSupabaseServiceRoleClient();
  const bucket = getSupabaseEnv().storageBucket;
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create signed upload URL');
  }

  return data.signedUrl;
}

export async function createSignedDownloadUrl(path: string, expiresIn = getSupabaseEnv().signedUrlTtl) {
  const supabase = createSupabaseServiceRoleClient();
  const bucket = getSupabaseEnv().storageBucket;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create signed download URL');
  }

  return data.signedUrl;
}

export async function deleteStoredObject(path: string) {
  const supabase = createSupabaseServiceRoleClient();
  const bucket = getSupabaseEnv().storageBucket;
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}
