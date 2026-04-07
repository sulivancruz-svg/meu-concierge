import { prisma } from '@/lib/db';
import { fetchAllMondePeople } from './client';
import type { MondePersonAttributes, MondePersonResource, MondeSyncResult } from './types';

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : null;
}

function parseMondeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildMondeNotes(attrs: MondePersonAttributes): string {
  const lines: string[] = [];

  if (attrs.cpf) lines.push(`CPF: ${attrs.cpf}`);
  if (attrs.rg) lines.push(`RG: ${attrs.rg}`);
  if (attrs.gender) lines.push(`Genero: ${attrs.gender}`);
  if (attrs['passport-expiration']) lines.push(`Passaporte valido ate: ${attrs['passport-expiration']}`);

  const addressParts = [
    attrs.address,
    attrs.number ? `${attrs.number}` : null,
    attrs.complement,
    attrs.district,
    attrs.zip,
  ].filter(Boolean);
  if (addressParts.length > 0) lines.push(`Endereco: ${addressParts.join(', ')}`);

  if (attrs.observations) lines.push(`Observacoes: ${attrs.observations}`);

  return lines.length > 0 ? lines.join('\n') : '';
}

function mergeNotes(existing: string | null, mondeNotes: string, syncDate: string): string {
  if (!mondeNotes) return existing ?? '';

  // Remove previous Monde block if present
  const cleaned = (existing ?? '').replace(/--- Dados Monde \(sync .*?\) ---[\s\S]*?(?=---|$)/g, '').trim();

  const mondeBlock = `--- Dados Monde (sync ${syncDate}) ---\n${mondeNotes}`;

  return cleaned ? `${cleaned}\n\n${mondeBlock}` : mondeBlock;
}

function mapMondePersonToPassenger(person: MondePersonResource) {
  const attrs = person.attributes;
  return {
    name: attrs.name,
    email: normalizeEmail(attrs.email),
    phone: normalizePhone(attrs['mobile-phone']) ?? normalizePhone(attrs.phone),
    passportNumber: attrs['passport-number'] || null,
    dateOfBirth: parseMondeDate(attrs['birth-date']),
    mondeExternalId: person.id,
  };
}

async function findExistingPassenger(
  agencyId: string,
  mondeId: string,
  email: string | null,
  phone: string | null,
  name: string,
) {
  // Priority 1: Match by mondeExternalId
  const byMondeId = await prisma.passenger.findFirst({
    where: { agencyId, mondeExternalId: mondeId, deletedAt: null },
  });
  if (byMondeId) return byMondeId;

  // Priority 2: Match by email
  if (email) {
    const byEmail = await prisma.passenger.findFirst({
      where: { agencyId, email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    });
    if (byEmail) return byEmail;
  }

  // Priority 3: Match by phone (last 8+ digits)
  if (phone) {
    const phoneSuffix = phone.slice(-8);
    const byPhone = await prisma.passenger.findFirst({
      where: {
        agencyId,
        phone: { endsWith: phoneSuffix },
        deletedAt: null,
      },
    });
    if (byPhone) return byPhone;
  }

  // Priority 4: Match by exact name (last resort)
  const byName = await prisma.passenger.findFirst({
    where: { agencyId, name: { equals: name, mode: 'insensitive' }, deletedAt: null },
  });
  return byName;
}

export async function syncMondePeople(agencyId: string): Promise<MondeSyncResult> {
  const start = Date.now();
  const result: MondeSyncResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    const mondePeople = await fetchAllMondePeople(agencyId);
    const syncDate = new Date().toISOString().slice(0, 10);

    for (const person of mondePeople) {
      try {
        // Skip juridical entities (companies)
        if (person.attributes.kind === 'J') {
          result.skipped++;
          continue;
        }

        // Skip if no name
        if (!person.attributes.name?.trim()) {
          result.skipped++;
          continue;
        }

        const mapped = mapMondePersonToPassenger(person);
        const mondeNotes = buildMondeNotes(person.attributes);

        const existing = await findExistingPassenger(
          agencyId,
          person.id,
          mapped.email,
          mapped.phone,
          mapped.name,
        );

        if (existing) {
          // UPDATE existing passenger
          await prisma.passenger.update({
            where: { id: existing.id },
            data: {
              mondeExternalId: person.id,
              name: mapped.name,
              email: mapped.email ?? existing.email,
              phone: mapped.phone ?? existing.phone,
              passportNumber: mapped.passportNumber ?? existing.passportNumber,
              dateOfBirth: mapped.dateOfBirth ?? existing.dateOfBirth,
              notes: mergeNotes(existing.notes, mondeNotes, syncDate),
            },
          });
          result.updated++;
        } else {
          // CREATE new passenger
          await prisma.passenger.create({
            data: {
              agencyId,
              mondeExternalId: person.id,
              name: mapped.name,
              email: mapped.email,
              phone: mapped.phone,
              passportNumber: mapped.passportNumber,
              dateOfBirth: mapped.dateOfBirth,
              notes: mondeNotes || null,
            },
          });
          result.imported++;
        }
      } catch (err) {
        result.errors.push({
          mondeId: person.id,
          name: person.attributes.name ?? 'Unknown',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  } catch (err) {
    result.durationMs = Date.now() - start;

    // Save error log
    await prisma.mondeSyncLog.create({
      data: {
        agencyId,
        trigger: 'manual',
        status: 'error',
        errors: [{ error: err instanceof Error ? err.message : 'Unknown error' }],
        durationMs: result.durationMs,
      },
    });

    await prisma.agency.update({
      where: { id: agencyId },
      data: {
        mondeLastSyncAt: new Date(),
        mondeLastSyncStatus: 'error',
        mondeLastSyncMeta: { error: err instanceof Error ? err.message : 'Unknown error' },
      },
    });

    throw err;
  }

  result.durationMs = Date.now() - start;

  const status = result.errors.length > 0
    ? (result.imported > 0 || result.updated > 0 ? 'partial' : 'error')
    : 'success';

  // Save sync log
  await prisma.mondeSyncLog.create({
    data: {
      agencyId,
      trigger: 'manual',
      status,
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors : undefined,
      durationMs: result.durationMs,
    },
  });

  // Update agency last sync info
  await prisma.agency.update({
    where: { id: agencyId },
    data: {
      mondeLastSyncAt: new Date(),
      mondeLastSyncStatus: status,
      mondeLastSyncMeta: {
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    },
  });

  return result;
}
