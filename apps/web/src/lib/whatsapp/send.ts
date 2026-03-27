// ─── Envio de mensagens via WhatsApp Cloud API (Meta) ────────────────────────

const WA_API_BASE = `https://graph.facebook.com/${process.env.WA_API_VERSION ?? 'v19.0'}`;

interface SendTextOptions {
  to: string;       // E.164 sem +
  body: string;
}

interface SendDocumentOptions {
  to: string;
  documentUrl: string;
  caption?: string;
  filename?: string;
}

interface WaApiResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string; code: number };
}

export interface WhatsAppSendResult {
  ok: boolean;
  messageId: string | null;
  errorCode?: string;
  errorMessage?: string;
}

async function waPost(endpoint: string, body: unknown): Promise<WaApiResponse> {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const accessToken = process.env.WA_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('Credenciais WhatsApp nao configuradas (WA_PHONE_NUMBER_ID ou WA_ACCESS_TOKEN ausente)');
  }

  const url = `${WA_API_BASE}/${phoneNumberId}/${endpoint}`;
  console.log(`[whatsapp] POST ${url} → to: ${(body as Record<string, unknown>)?.to ?? '?'}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as WaApiResponse;

  if (!res.ok) {
    const errMsg = data.error?.message ?? res.statusText;
    const errCode = data.error?.code ?? res.status;
    console.error(`[whatsapp] API error ${errCode}: ${errMsg}`);
    throw new Error(`WhatsApp API error ${errCode}: ${errMsg}`);
  }

  if (!data.messages?.length) {
    console.warn('[whatsapp] Resposta sem message ID:', JSON.stringify(data));
  } else {
    console.log(`[whatsapp] Enviado com sucesso. waMessageId: ${data.messages[0].id}`);
  }

  return data;
}

export async function sendWhatsAppText({ to, body }: SendTextOptions): Promise<WhatsAppSendResult> {
  try {
    const res = await waPost('messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    });

    const messageId = res.messages?.[0]?.id ?? null;
    if (!messageId) {
      return {
        ok: false,
        messageId: null,
        errorMessage: 'API retornou sucesso mas sem message ID',
      };
    }

    return { ok: true, messageId };
  } catch (err) {
    console.error('[whatsapp] Erro ao enviar texto:', err);
    return {
      ok: false,
      messageId: null,
      errorCode: err instanceof Error && err.message.includes('API error') ? err.message.match(/error (\d+)/)?.[1] : undefined,
      errorMessage: err instanceof Error ? err.message : 'Erro ao enviar texto no WhatsApp.',
    };
  }
}

export async function sendWhatsAppDocument({
  to,
  documentUrl,
  caption,
  filename,
}: SendDocumentOptions): Promise<WhatsAppSendResult> {
  try {
    const res = await waPost('messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: { link: documentUrl, caption, filename },
    });

    const messageId = res.messages?.[0]?.id ?? null;
    if (!messageId) {
      return {
        ok: false,
        messageId: null,
        errorMessage: 'API retornou sucesso mas sem message ID',
      };
    }

    return { ok: true, messageId };
  } catch (err) {
    console.error('[whatsapp] Erro ao enviar documento:', err);
    return {
      ok: false,
      messageId: null,
      errorMessage: err instanceof Error ? err.message : 'Erro ao enviar documento no WhatsApp.',
    };
  }
}

export async function markAsRead(waMessageId: string): Promise<void> {
  try {
    await waPost('messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: waMessageId,
    });
  } catch {
    // Nao critico
  }
}
