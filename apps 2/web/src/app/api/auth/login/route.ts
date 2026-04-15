import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findAgencyUserByAuthUserId, touchAgencyUserLastLogin } from '@/lib/auth';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

const PLATFORM_OWNER_AGENCY_SLUG = (process.env.PLATFORM_OWNER_AGENCY_SLUG ?? 'sulivan-cruz').trim().toLowerCase();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = LoginSchema.parse(await request.json());
    const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error || !data.user) {
      return applyCookies(NextResponse.json({ error: 'Credenciais invalidas.' }, { status: 401 }));
    }

    const agencyUser = await findAgencyUserByAuthUserId(data.user.id);

    if (!agencyUser) {
      await supabase.auth.signOut();
      return applyCookies(NextResponse.json({ error: 'Usuario sem acesso administrativo.' }, { status: 403 }));
    }

    // Platform owner must use /admin/login
    const { data: agency } = await supabase
      .from('agencies')
      .select('slug')
      .eq('id', agencyUser.agencyId)
      .maybeSingle();

    if (agency?.slug.toLowerCase() === PLATFORM_OWNER_AGENCY_SLUG && agencyUser.role === 'OWNER') {
      await supabase.auth.signOut();
      return applyCookies(NextResponse.json({ error: 'Use o acesso de plataforma em /admin/login.' }, { status: 403 }));
    }

    await touchAgencyUserLastLogin(agencyUser.id);

    return applyCookies(NextResponse.json({ ok: true }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }

    if (error instanceof Error && error.message.includes('Missing Supabase environment variable')) {
      return NextResponse.json({ error: 'Supabase nao configurado no ambiente.' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao autenticar.' }, { status: 500 });
  }
}
