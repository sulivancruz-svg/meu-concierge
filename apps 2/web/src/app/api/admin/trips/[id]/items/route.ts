import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

const Schema = z.object({
  type: z.enum(['FLIGHT', 'HOTEL', 'TRANSPORT', 'TOUR', 'TRAIN', 'INSURANCE', 'NOTE']),
  title: z.string().min(1),
  providerName: z.string().optional().nullable(),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  confirmationCode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  passengerId: z.string().optional().nullable(),
});

async function getTripOrThrow(agencyId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, agencyId },
  });
  if (!trip) throw new Error('not_found');
  return trip;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(session.user.agencyId, params.id);

    const items = await prisma.tripItem.findMany({
      where: { tripId: params.id, agencyId: session.user.agencyId },
      orderBy: [{ startAt: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(items);
  } catch (e: unknown) {
    if ((e as Error).message === 'not_found') return NextResponse.json({ error: 'Viagem não encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(session.user.agencyId, params.id);

    const body = Schema.parse(await req.json());

    const item = await prisma.tripItem.create({
      data: {
        agencyId: session.user.agencyId,
        tripId: params.id,
        passengerId: body.passengerId || null,
        type: body.type,
        title: body.title.trim(),
        providerName: body.providerName?.trim() || null,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        location: body.location?.trim() || null,
        confirmationCode: body.confirmationCode?.trim() || null,
        description: body.description?.trim() || null,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (e: unknown) {
    if ((e as Error).message === 'not_found') return NextResponse.json({ error: 'Viagem não encontrada' }, { status: 404 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 422 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
