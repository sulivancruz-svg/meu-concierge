import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { registerAeroDataBoxSubscription } from '@/modules/integrations/aerodatabox/service';

export async function POST(_req: Request, { params }: { params: { id: string; flightId: string } }) {
  try {
    const session = await requireAdmin();
    const flight = await prisma.flightSegment.findFirst({
      where: {
        id: params.flightId,
        tripId: params.id,
        trip: {
          agencyId: session.user.agencyId,
        },
      },
      select: { id: true },
    });

    if (!flight) {
      return NextResponse.json({ error: 'Voo nao encontrado' }, { status: 404 });
    }

    const registration = await registerAeroDataBoxSubscription(flight.id);
    return NextResponse.json({ ok: true, monitoring: registration });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
