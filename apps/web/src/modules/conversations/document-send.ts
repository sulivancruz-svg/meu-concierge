import { prisma } from '@/lib/db';
import { createSignedDownloadUrl } from '@/lib/storage';
import { sendWhatsAppDocument, type WhatsAppSendResult } from '@/lib/whatsapp/send';

type SuggestedDocumentInput = {
  id: string;
  title: string;
  category: string;
};

type AutoSendSuggestedDocumentInput = {
  agencyId: string;
  conversationId: string;
  phone: string | null;
  tripId?: string | null;
  passengerId?: string | null;
  suggestedDocuments: SuggestedDocumentInput[];
  captionPrefix?: string;
};

export type AutoSendSuggestedDocumentResult = {
  attempted: boolean;
  sent: boolean;
  messageRecordId: string | null;
  documentId: string | null;
  documentName: string | null;
  waMessageId: string | null;
  errorMessage?: string;
};

export async function autoSendSuggestedDocumentForConversation(
  input: AutoSendSuggestedDocumentInput,
): Promise<AutoSendSuggestedDocumentResult> {
  if (!input.phone) {
    return {
      attempted: false,
      sent: false,
      messageRecordId: null,
      documentId: null,
      documentName: null,
      waMessageId: null,
      errorMessage: 'Conversa sem telefone associado',
    };
  }

  const suggestionIds = input.suggestedDocuments.map((document) => document.id).filter(Boolean);
  if (!suggestionIds.length) {
    return {
      attempted: false,
      sent: false,
      messageRecordId: null,
      documentId: null,
      documentName: null,
      waMessageId: null,
      errorMessage: 'Nenhum documento sugerido para envio',
    };
  }

  const documents = await prisma.document.findMany({
    where: {
      id: { in: suggestionIds },
      agencyId: input.agencyId,
      deletedAt: null,
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.passengerId
        ? {
            OR: [
              { passengerId: null },
              { passengerId: input.passengerId },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      storagePath: true,
      mimeType: true,
    },
  });

  const documentMap = new Map(documents.map((document) => [document.id, document]));
  const selectedDocument = suggestionIds.map((id) => documentMap.get(id) ?? null).find(Boolean) ?? null;

  if (!selectedDocument) {
    return {
      attempted: false,
      sent: false,
      messageRecordId: null,
      documentId: null,
      documentName: null,
      waMessageId: null,
      errorMessage: 'Documento sugerido nao encontrado para esta conversa',
    };
  }

  let signedUrl: string | null = null;
  try {
    signedUrl = await createSignedDownloadUrl(selectedDocument.storagePath);
  } catch (error) {
    return {
      attempted: true,
      sent: false,
      messageRecordId: null,
      documentId: selectedDocument.id,
      documentName: selectedDocument.name,
      waMessageId: null,
      errorMessage: error instanceof Error ? error.message : 'Erro ao gerar link do documento',
    };
  }

  const waResult: WhatsAppSendResult = await sendWhatsAppDocument({
    to: input.phone,
    documentUrl: signedUrl,
    filename: selectedDocument.name,
    caption: `${input.captionPrefix ?? 'Documento enviado pela agencia'}: ${selectedDocument.name}`,
  });

  const createdMessage = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      role: 'SYSTEM',
      channel: waResult.ok ? 'WHATSAPP' : 'INTERNAL',
      body: `Documento enviado: ${selectedDocument.name}`,
      mediaUrl: signedUrl,
      direction: 'OUTBOUND',
      payload: {
        kind: 'document-send',
        trigger: 'concierge-auto',
        documentId: selectedDocument.id,
        mimeType: selectedDocument.mimeType,
      },
      waMessageId: waResult.messageId,
      waStatus: waResult.ok ? 'SENT' : 'FAILED',
      waErrorCode: waResult.errorCode ?? null,
      waErrorMsg: waResult.errorMessage ?? null,
      sentAt: new Date(),
      failedAt: waResult.ok ? null : new Date(),
    },
  });

  return {
    attempted: true,
    sent: waResult.ok,
    messageRecordId: createdMessage.id,
    documentId: selectedDocument.id,
    documentName: selectedDocument.name,
    waMessageId: waResult.messageId,
    errorMessage: waResult.errorMessage,
  };
}
