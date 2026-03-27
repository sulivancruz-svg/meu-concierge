import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateConciergeMockReply } from '@/lib/ai/concierge';
import { sendWhatsAppText, type WhatsAppSendResult } from '@/lib/whatsapp/send';
import { getConversationDetail, resolveConversationTripId } from '@/modules/conversations/service';

const MessageSchema = z.object({
  body: z.string().min(1),
  mode: z.enum(['passenger', 'assistant', 'agent']).default('passenger'),
});

async function trySendWhatsApp(phone: string | null, text: string): Promise<WhatsAppSendResult> {
  if (!phone) {
    return { ok: false, messageId: null, errorMessage: 'Conversa sem telefone associado' };
  }

  return sendWhatsAppText({ to: phone, body: text });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const body = MessageSchema.parse(await req.json());
    const conversation = await prisma.conversation.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const now = new Date();
    const createdIds: string[] = [];
    let resolvedTripId: string | null | undefined = conversation.tripId;

    if (body.mode === 'passenger') {
      const inbound = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'USER',
          channel: 'INTERNAL',
          body: body.body.trim(),
          direction: 'INBOUND',
          waStatus: 'READ',
          deliveredAt: now,
          readAt: now,
        },
      });
      createdIds.push(inbound.id);

      resolvedTripId = conversation.tripId ?? await resolveConversationTripId({
        agencyId: session.user.agencyId,
        passengerId: conversation.passengerId,
        tripId: null,
      });

      let assistantText = 'Nao encontrei uma viagem ativa para responder com seguranca.';
      let payload: Prisma.InputJsonValue | undefined;

      if (resolvedTripId) {
        const reply = await generateConciergeMockReply({
          message: body.body.trim(),
          tripId: resolvedTripId,
          passengerId: conversation.passengerId,
        });

        assistantText = reply.text;
        payload = reply.suggestedDocuments.length
          ? {
              suggestedDocuments: reply.suggestedDocuments,
              source: reply.source,
            } as Prisma.InputJsonValue
          : { source: reply.source } as Prisma.InputJsonValue;
      }

      // Enviar resposta do concierge via WhatsApp
      const waResult = await trySendWhatsApp(conversation.phone, assistantText);

      const assistant = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          channel: waResult.ok ? 'WHATSAPP' : 'INTERNAL',
          body: assistantText,
          direction: 'OUTBOUND',
          payload,
          waMessageId: waResult.messageId,
          waStatus: waResult.ok ? 'SENT' : 'FAILED',
          waErrorCode: waResult.errorCode ?? null,
          waErrorMsg: waResult.errorMessage ?? null,
          sentAt: new Date(),
          aiModel: 'mock-concierge-v1',
        },
      });
      createdIds.push(assistant.id);
    } else {
      // Modo agent ou assistant: enviar via WhatsApp
      const waResult = await trySendWhatsApp(conversation.phone, body.body.trim());

      const outbound = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: body.mode === 'agent' ? 'SYSTEM' : 'ASSISTANT',
          channel: waResult.ok ? 'WHATSAPP' : 'INTERNAL',
          body: body.body.trim(),
          direction: 'OUTBOUND',
          payload: body.mode === 'agent' ? { senderLabel: 'Agencia' } : { source: 'manual-assistant' },
          waMessageId: waResult.messageId,
          waStatus: waResult.ok ? 'SENT' : 'FAILED',
          waErrorCode: waResult.errorCode ?? null,
          waErrorMsg: waResult.errorMessage ?? null,
          sentAt: now,
          aiModel: body.mode === 'assistant' ? 'mock-concierge-v1' : null,
        },
      });
      createdIds.push(outbound.id);
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: 'OPEN',
        tripId: resolvedTripId ?? conversation.tripId,
        lastMessageAt: now,
      },
    });

    const detail = await getConversationDetail(session.user.agencyId, conversation.id);
    return NextResponse.json({ conversation: detail, createdIds });
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
