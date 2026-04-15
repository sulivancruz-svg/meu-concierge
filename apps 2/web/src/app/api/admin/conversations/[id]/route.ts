import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getConversationDetail, resolveConversationTripId } from '@/modules/conversations/service';

const UpdateConversationSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional(),
  tripId: z.string().optional().or(z.literal('')),
  contextSummary: z.string().optional().or(z.literal('')),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const conversation = await getConversationDetail(session.user.agencyId, params.id);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const body = UpdateConversationSchema.parse(await req.json());
    const existing = await prisma.conversation.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const resolvedTripId = body.tripId !== undefined
      ? await resolveConversationTripId({
          agencyId: session.user.agencyId,
          passengerId: existing.passengerId,
          tripId: body.tripId || null,
        })
      : undefined;

    await prisma.conversation.update({
      where: { id: existing.id },
      data: {
        status: body.status,
        tripId: resolvedTripId,
        contextSummary: body.contextSummary !== undefined
          ? (body.contextSummary?.trim() || null)
          : undefined,
      },
    });

    const conversation = await getConversationDetail(session.user.agencyId, existing.id);
    return NextResponse.json(conversation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
