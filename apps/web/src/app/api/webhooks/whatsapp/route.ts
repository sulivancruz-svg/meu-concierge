import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateConciergeMockReply } from '@/lib/ai/concierge';
import { markAsRead, sendWhatsAppText } from '@/lib/whatsapp/send';
import { autoSendSuggestedDocumentForConversation } from '@/modules/conversations/document-send';
import {
  findOrCreateWhatsAppConversation,
  parseWhatsAppTextMessages,
  resolveActiveTripForPassenger,
  resolveAgencyFromWebhook,
  resolvePassengerFromWhatsApp,
  verifyWhatsAppSignature,
} from '@/modules/integrations/whatsapp/service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    if (!verifyWhatsAppSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const messages = parseWhatsAppTextMessages(payload);

    if (!messages.length) {
      return NextResponse.json({ status: 'no_messages' });
    }

    const processed: string[] = [];

    for (const message of messages) {
      const agencyId = await resolveAgencyFromWebhook(message.metadata);
      if (!agencyId) {
        continue;
      }

      await markAsRead(message.waMessageId);

      const passenger = await resolvePassengerFromWhatsApp(agencyId, message.fromPhone);
      const tripId = await resolveActiveTripForPassenger(agencyId, passenger?.id ?? null);
      const conversation = await findOrCreateWhatsAppConversation({
        agencyId,
        phone: message.fromPhone,
        passengerId: passenger?.id ?? null,
        tripId,
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'USER',
          channel: 'WHATSAPP',
          direction: 'INBOUND',
          body: message.body,
          waMessageId: message.waMessageId,
          waStatus: 'READ',
          deliveredAt: new Date(),
          readAt: new Date(),
          payload: {
            webhook: message.raw as Prisma.InputJsonValue,
          },
        },
      });

      const reply = !passenger
        ? {
            text: 'Nao consegui localizar seu numero no sistema. Por favor, fale com a agencia.',
            suggestedDocuments: [],
            shouldAutoSendSuggestedDocument: false,
            source: 'none' as const,
          }
        : tripId
          ? await generateConciergeMockReply({
              message: message.body,
              tripId,
              passengerId: passenger.id,
            })
          : {
              text: `Oi, ${passenger.name.split(' ')[0]}. Nao encontrei uma viagem ativa no seu cadastro no momento.`,
              suggestedDocuments: [],
              shouldAutoSendSuggestedDocument: false,
              source: 'none' as const,
            };

      const waResult = await sendWhatsAppText({
        to: message.fromPhone,
        body: reply.text,
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          direction: 'OUTBOUND',
          body: reply.text,
          waMessageId: waResult.messageId,
          waStatus: waResult.ok ? 'SENT' : 'FAILED',
          waErrorCode: waResult.errorCode ?? null,
          waErrorMsg: waResult.errorMessage ?? null,
          sentAt: new Date(),
          aiModel: 'mock-concierge-v1',
          payload: {
            source: reply.source,
            suggestedDocuments: reply.suggestedDocuments,
          },
        },
      });

      if (reply.shouldAutoSendSuggestedDocument && reply.suggestedDocuments.length) {
        await autoSendSuggestedDocumentForConversation({
          agencyId,
          conversationId: conversation.id,
          phone: conversation.phone,
          tripId: tripId ?? conversation.tripId,
          passengerId: passenger?.id ?? conversation.passengerId,
          suggestedDocuments: reply.suggestedDocuments,
          captionPrefix: 'Documento solicitado pelo passageiro',
        });
      }

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          passengerId: passenger?.id ?? conversation.passengerId,
          tripId: tripId ?? conversation.tripId,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });

      processed.push(conversation.id);
    }

    return NextResponse.json({ status: 'ok', processed });
  } catch (error) {
    console.error('[webhook/whatsapp]', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
