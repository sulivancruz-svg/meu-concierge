import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { syncMondePeople } from '@/modules/integrations/monde/service';

export async function POST() {
  try {
    const session = await requireAdmin();
    const result = await syncMondePeople(session.user.agencyId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';

    if (message === 'MONDE_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: 'Credenciais do Monde nao configuradas' },
        { status: 400 },
      );
    }

    if (message.startsWith('MONDE_AUTH_ERROR')) {
      return NextResponse.json(
        { error: message.replace('MONDE_AUTH_ERROR: ', '') },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: 'Erro ao sincronizar' }, { status: 500 });
  }
}
