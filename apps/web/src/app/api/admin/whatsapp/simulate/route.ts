import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateConciergeMockReply } from '@/lib/ai/concierge';
import { sendWhatsAppText } from '@/lib/whatsapp/send';
import { autoSendSuggestedDocumentForConversation } from '@/modules/conversations/document-send';
import {
  findOrCreateWhatsAppConversation,
  normalizeWhatsAppPhone,
  resolveActiveTripForPassenger,
  resolvePassengerFromWhatsApp,
} from '@/modules/integrations/whatsapp/service';

const Schema = z.object({
  phone: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = Schema.parse(await req.json());
    const phone = normalizeWhatsAppPhone(body.phone);
    const passenger = await resolvePassengerFromWhatsApp(session.user.agencyId, phone);
    const tripId = await resolveActiveTripForPassenger(session.user.agencyId, passenger?.id ?? null);

    const conversation = await findOrCreateWhatsAppConversation({
      agencyId: session.user.agencyId,
      phone,
      passengerId: passenger?.id ?? null,
      tripId,
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        body: body.message.trim(),
        waStatus: 'READ',
        deliveredAt: new Date(),
        readAt: new Date(),
      },
    });

    const reply = !passenger
      ? {
          text: 'Nao consegui localizar seu numero no sistema. Entre em contato com a agencia.',
          suggestedDocuments: [],
          shouldAutoSendSuggestedDocument: false,
          source: 'none' as const,
        }
      : tripId
        ? await generateConciergeMockReply({
            message: body.message.trim(),
            tripId,
            passengerId: passenger.id,
          })
        : {
            text: `Oi, ${passenger.name.split(' ')[0]}. Nao encontrei uma viagem ativa no seu cadastro.`,
            suggestedDocuments: [],
            shouldAutoSendSuggestedDocument: false,
            source: 'none' as const,
          };

    // Enviar resposta via WhatsApp
    const waResult = await sendWhatsAppText({ to: phone, body: reply.text });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        body: reply.text,
        payload: {
          source: reply.source,
          suggestedDocuments: reply.suggestedDocuments,
        },
        waMessageId: waResult.messageId,
        waStatus: waResult.ok ? 'SENT' : 'FAILED',
        waErrorCode: waResult.errorCode ?? null,
        waErrorMsg: waResult.errorMessage ?? null,
        sentAt: new Date(),
        aiModel: 'mock-concierge-v1',
      },
    });

    const autoDocumentResult = reply.shouldAutoSendSuggestedDocument && reply.suggestedDocuments.length
      ? await autoSendSuggestedDocumentForConversation({
          agencyId: session.user.agencyId,
          conversationId: conversation.id,
          phone: conversation.phone,
          tripId: tripId ?? conversation.tripId,
          passengerId: passenger?.id ?? conversation.passengerId,
          suggestedDocuments: reply.suggestedDocuments,
          captionPrefix: 'Documento solicitado pelo passageiro',
        })
      : null;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: 'OPEN',
        passengerId: passenger?.id ?? conversation.passengerId,
        tripId: tripId ?? conversation.tripId,
        lastMessageAt: new Date(),
      },
    });

    return NextResponse.json({
      response: reply.text,
      passengerName: passenger?.name ?? null,
      tripTitle: tripId
        ? (await prisma.trip.findUnique({
            where: { id: tripId },
            select: { title: true },
          }))?.title ?? null
        : null,
      source: reply.source,
      suggestedDocuments: reply.suggestedDocuments,
      autoSentDocument: autoDocumentResult,
      waStatus: waResult.ok ? 'SENT' : 'FAILED',
      waMessageId: waResult.messageId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }

    console.error(error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
