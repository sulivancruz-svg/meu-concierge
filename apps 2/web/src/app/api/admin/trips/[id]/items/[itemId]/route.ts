import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

const Schema = z.object({
  type: z.enum(['FLIGHT', 'HOTEL', 'TRANSPORT', 'TOUR', 'TRAIN', 'INSURANCE', 'NOTE']).optional(),
  title: z.string().min(1).optional(),
  providerName: z.string().optional().nullable(),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  confirmationCode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  passengerId: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    const session = await requireAdmin();
    const item = await prisma.tripItem.findFirst({
      where: { id: params.itemId, tripId: params.id, agencyId: session.user.agencyId },
    });
    if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

    const body = Schema.parse(await req.json());

    const updated = await prisma.tripItem.update({
      where: { id: params.itemId },
      data: {
        ...(body.type && { type: body.type }),
        ...(body.title && { title: body.title.trim() }),
        providerName: body.providerName !== undefined ? (body.providerName?.trim() || null) : undefined,
        startAt: body.startAt !== undefined ? (body.startAt ? new Date(body.startAt) : null) : undefined,
        endAt: body.endAt !== undefined ? (body.endAt ? new Date(body.endAt) : null) : undefined,
        location: body.location !== undefined ? (body.location?.trim() || null) : undefined,
        confirmationCode: body.confirmationCode !== undefined ? (body.confirmationCode?.trim() || null) : undefined,
        description: body.description !== undefined ? (body.description?.trim() || null) : undefined,
        passengerId: body.passengerId !== undefined ? (body.passengerId || null) : undefined,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 422 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  try {
    const session = await requireAdmin();
    const item = await prisma.tripItem.findFirst({
      where: { id: params.itemId, tripId: params.id, agencyId: session.user.agencyId },
    });
    if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

    await prisma.tripItem.delete({ where: { id: params.itemId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
