import { NextRequest, NextResponse } from 'next/server';
import {
  handleAeroDataBoxWebhook,
  verifyAeroDataBoxWebhook,
} from '@/modules/integrations/aerodatabox/service';

export async function POST(req: NextRequest) {
  try {
    const secretHeader = req.headers.get('x-aerodatabox-secret') || req.headers.get('x-webhook-secret');
    if (!verifyAeroDataBoxWebhook(secretHeader)) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const payload = await req.json() as Record<string, unknown>;
    const applied = await handleAeroDataBoxWebhook(payload);

    return NextResponse.json({
      status: 'ok',
      appliedCount: applied.length,
      flights: applied,
    });
  } catch (error) {
    console.error('[webhook/aerodatabox]', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
