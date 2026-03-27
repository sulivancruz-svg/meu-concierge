import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { mergeTripOperationalMeta, readTripOperationalMeta } from '@/modules/trips/trip-meta';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();

    const trip = await prisma.trip.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });
    if (!trip) return NextResponse.json({ error: 'Viagem não encontrada' }, { status: 404 });

    await prisma.trip.update({
      where: { id: params.id },
      data: {
        isActiveForWhatsapp: true,
        structuredMetadata: mergeTripOperationalMeta(trip.structuredMetadata, {
          internalCode: readTripOperationalMeta(trip.structuredMetadata).internalCode,
          activeForWhatsApp: true,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
