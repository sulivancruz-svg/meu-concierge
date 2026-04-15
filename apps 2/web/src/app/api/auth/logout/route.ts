import { NextRequest, NextResponse } from 'next/server';
import {
  PLATFORM_AGENCY_CONTEXT_ID_COOKIE,
  PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE,
} from '@/lib/platform-context';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request);
  await supabase.auth.signOut();
  const response = applyCookies(NextResponse.json({ ok: true }));
  response.cookies.delete(PLATFORM_AGENCY_CONTEXT_ID_COOKIE);
  response.cookies.delete(PLATFORM_AGENCY_CONTEXT_SLUG_COOKIE);
  return response;
}
