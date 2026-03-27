import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { normalizeWhatsAppPhone } from '@/modules/integrations/whatsapp/service';
import { listConversations, resolveConversationTripId } from '@/modules/conversations/service';

const CreateConversationSchema = z.object({
  passengerId: z.string().optional().or(z.literal('')),
  tripId: z.string().optional().or(z.literal('')),
  phone: z.string().min(6),
  contextSummary: z.string().optional().or(z.literal('')),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    const items = await listConversations(session.user.agencyId);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = CreateConversationSchema.parse(await req.json());
    const passengerId = body.passengerId || null;
    const tripId = await resolveConversationTripId({
      agencyId: session.user.agencyId,
      passengerId,
      tripId: body.tripId || null,
    });

    const conversation = await prisma.conversation.create({
      data: {
        agencyId: session.user.agencyId,
        passengerId,
        tripId,
        phone: normalizeWhatsAppPhone(body.phone),
        contextSummary: body.contextSummary?.trim() || null,
      },
    });

    return NextResponse.json({ id: conversation.id }, { status: 201 });
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
