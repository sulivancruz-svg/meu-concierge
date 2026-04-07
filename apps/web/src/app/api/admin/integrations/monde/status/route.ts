import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await requireAdmin();

    const agency = await prisma.agency.findUniqueOrThrow({
      where: { id: session.user.agencyId },
      select: {
        mondeEnabled: true,
        mondeLogin: true,
        mondeLastSyncAt: true,
        mondeLastSyncStatus: true,
        mondeLastSyncMeta: true,
      },
    });

    const recentLogs = await prisma.mondeSyncLog.findMany({
      where: { agencyId: session.user.agencyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      enabled: agency.mondeEnabled,
      login: agency.mondeLogin,
      lastSyncAt: agency.mondeLastSyncAt,
      lastSyncStatus: agency.mondeLastSyncStatus,
      lastSyncMeta: agency.mondeLastSyncMeta,
      recentLogs,
    });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
