import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listAgencyAlerts, syncOperationalAlertsForAgency } from '@/modules/alerts/service';

export async function GET() {
  try {
    const session = await requireAdmin();
    await syncOperationalAlertsForAgency(session.user.agencyId);
    const items = await listAgencyAlerts(session.user.agencyId, { includeResolved: true, take: 50 });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
