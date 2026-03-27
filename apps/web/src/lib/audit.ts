import type { Prisma } from '@prisma/client';
import { prisma } from './db';

export async function createAuditLog({
  agencyId,
  userId,
  action,
  entityType,
  entityId,
  meta,
  ipAnon,
}: {
  agencyId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  ipAnon?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: { agencyId, userId, action, entityType, entityId, meta, ipAnon },
    });
  } catch {
    // Não deixar falha de auditoria quebrar a operação principal
  }
}
