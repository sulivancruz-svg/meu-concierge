import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createSignedDownloadUrl } from '@/lib/storage';
import { sendWhatsAppDocument } from '@/lib/whatsapp/send';
import { getConversationDetail } from '@/modules/conversations/service';

export async function POST(
  _req: Request,
  { params }: { params: { id: string; documentId: string } },
) {
  try {
    const session = await requireAdmin();
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: params.id,
        agencyId: session.user.agencyId,
      },
      select: {
        id: true,
        phone: true,
        tripId: true,
        passengerId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversa nao encontrada' }, { status: 404 });
    }

    const document = await prisma.document.findFirst({
      where: {
        id: params.documentId,
        agencyId: session.user.agencyId,
        deletedAt: null,
        ...(conversation.tripId ? { tripId: conversation.tripId } : {}),
        ...(conversation.passengerId ? {
          OR: [
            { passengerId: null },
            { passengerId: conversation.passengerId },
          ],
        } : {}),
      },
      select: {
        id: true,
        name: true,
        storagePath: true,
        mimeType: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento nao encontrado para esta conversa' }, { status: 404 });
    }

    let signedUrl: string | null = null;
    try {
      signedUrl = await createSignedDownloadUrl(document.storagePath);
    } catch (err) {
      console.error('[document-send] Erro ao gerar URL de download:', err);
      signedUrl = null;
    }

    if (!signedUrl) {
      return NextResponse.json(
        { error: 'Nao foi possivel gerar link de download do documento' },
        { status: 502 },
      );
    }

    const waResult = await sendWhatsAppDocument({
      to: conversation.phone,
      documentUrl: signedUrl,
      filename: document.name,
      caption: `Documento enviado pela agencia: ${document.name}`,
    });

    const now = new Date();
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'SYSTEM',
        channel: 'WHATSAPP',
        body: `Documento enviado: ${document.name}`,
        mediaUrl: signedUrl,
        direction: 'OUTBOUND',
        payload: {
          kind: 'document-send',
          documentId: document.id,
          mimeType: document.mimeType,
        },
        waMessageId: waResult.messageId,
        waStatus: waResult.ok ? 'SENT' : 'FAILED',
        waErrorCode: waResult.errorCode ?? null,
        waErrorMsg: waResult.errorMessage ?? null,
        sentAt: now,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, status: 'OPEN' },
    });

    const detail = await getConversationDetail(session.user.agencyId, conversation.id);
    return NextResponse.json({
      ok: true,
      conversation: detail,
      waMessageId: waResult.messageId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
