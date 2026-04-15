import { NextResponse } from 'next/server';
import { requirePlatformOwner } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    await requirePlatformOwner();

    const agencies = await db.agency.findMany({
      where: { status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            users: {
              where: { status: 'ACTIVE', deletedAt: null },
            },
          },
        },
      },
    });

    return NextResponse.json({ agencies });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Erro ao buscar agencias.' }, { status: 500 });
  }
}
