import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const alert = await prisma.alert.findFirst({
      where: {
        id: params.id,
        agencyId: session.user.agencyId,
      },
      select: { id: true },
    });

    if (!alert) {
      return NextResponse.json({ error: 'Alerta nao encontrado' }, { status: 404 });
    }

    await prisma.alert.update({
      where: { id: alert.id },
      data: { resolvedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
