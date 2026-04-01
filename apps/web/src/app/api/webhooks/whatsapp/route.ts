import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsAppText } from '@/lib/whatsapp/send';
import {
  findOrCreateWhatsAppConversation,
  resolveActiveTripForPassenger,
  resolvePassengerFromWhatsApp,
} from '@/modules/integrations/whatsapp/service';
import { generateConciergeMockReply } from '@/lib/ai/concierge';

const WEBHOOK_VERIFY_TOKEN = process.env.WA_WEBHOOK_VERIFY_TOKEN || 'wh_verify_2025_concierge_production_secure_token_7a9d8f2c3b1e4d6a';

/**
 * GET /api/webhooks/whatsapp
 * Meta webhook verification challenge
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const token = searchParams.get('hub.verify_token');

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('[whatsapp-webhook] Webhook verified successfully');
    return new Response(challenge, { status: 200 });
  }

  console.warn('[whatsapp-webhook] Webhook verification failed - invalid token or mode');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Receive incoming WhatsApp messages from Meta
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Meta sends multiple objects, we process only messages
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) {
      // Webhook received but no message (e.g., status update, delivery confirmation)
      console.log('[whatsapp-webhook] Received non-message webhook event');
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    const message = value.messages[0];
    const from = value.messages[0].from; // Phone number in E.164 format
    const messageBody = message.text?.body;

    if (!messageBody) {
      console.log('[whatsapp-webhook] Received message without text body');
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    console.log(`[whatsapp-webhook] Received message from ${from}: "${messageBody}"`);

    // Find the agency - for now assume there's a default/primary agency
    // In production, you might need to determine this from webhook metadata
    const agencies = await prisma.agency.findMany({ take: 1 });
    const agencyId = agencies[0]?.id;

    if (!agencyId) {
      console.error('[whatsapp-webhook] No agency found');
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    // Resolve passenger and trip
    const passenger = await resolvePassengerFromWhatsApp(agencyId, from);
    const tripId = await resolveActiveTripForPassenger(agencyId, passenger?.id ?? null);

    // Find or create conversation
    const conversation = await findOrCreateWhatsAppConversation({
      agencyId,
      phone: from,
      passengerId: passenger?.id ?? null,
      tripId,
    });

    // Store incoming message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        body: messageBody.trim(),
        waStatus: 'READ',
        waMessageId: message.id,
        deliveredAt: new Date(),
        readAt: new Date(),
      },
    });

    // Generate reply based on passenger and trip status
    const reply = !passenger
      ? {
          text: 'Nao consegui localizar seu numero no sistema. Entre em contato com a agencia.',
          suggestedDocuments: [],
          shouldAutoSendSuggestedDocument: false,
          source: 'none' as const,
        }
      : tripId
        ? await generateConciergeMockReply({
            message: messageBody.trim(),
            tripId,
            passengerId: passenger.id,
          })
        : {
            text: `Oi, ${passenger.name.split(' ')[0]}. Nao encontrei uma viagem ativa no seu cadastro.`,
            suggestedDocuments: [],
            shouldAutoSendSuggestedDocument: false,
            source: 'none' as const,
          };

    // Send reply via WhatsApp
    const waResult = await sendWhatsAppText({ to: from, body: reply.text });

    // Store outbound message
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

    // Update conversation status
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: 'OPEN',
        passengerId: passenger?.id ?? conversation.passengerId,
        tripId: tripId ?? conversation.tripId,
        lastMessageAt: new Date(),
      },
    });

    console.log(`[whatsapp-webhook] Processed message and sent reply`);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('[whatsapp-webhook] Error processing webhook:', error);
    // Always return 200 to prevent Meta from retrying and spamming logs
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}
