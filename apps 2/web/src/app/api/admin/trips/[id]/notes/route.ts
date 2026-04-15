import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow } from '@/modules/trips/operations';

const NoteSchema = z.object({ body: z.string().min(1) });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const notes = await prisma.internalNote.findMany({
      where: { tripId: params.id },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return NextResponse.json(notes);
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const body = NoteSchema.parse(await req.json());
    const note = await prisma.internalNote.create({
      data: { tripId: params.id, authorId: session.user.id, body: body.body.trim() },
      include: { author: { select: { id: true, name: true } } },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 422 });
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
