import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow } from '@/modules/trips/operations';

const NoteSchema = z.object({ body: z.string().min(1) });

export async function PATCH(req: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.internalNote.findFirst({ where: { id: params.noteId, tripId: params.id } });
    if (!existing) return NextResponse.json({ error: 'Nota nao encontrada' }, { status: 404 });
    const body = NoteSchema.parse(await req.json());
    const note = await prisma.internalNote.update({
      where: { id: params.noteId },
      data: { body: body.body.trim() },
      include: { author: { select: { id: true, name: true } } },
    });
    return NextResponse.json(note);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 422 });
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    await prisma.internalNote.delete({ where: { id: params.noteId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
