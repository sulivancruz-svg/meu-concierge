import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findAgencyUserByAuthUserId, touchAgencyUserLastLogin } from '@/lib/auth';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

const PLATFORM_OWNER_AGENCY_SLUG = (process.env.PLATFORM_OWNER_AGENCY_SLUG ?? 'sulivan-cruz').trim().toLowerCase();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
      return applyCookies(NextResponse.json({ error: 'Utilizador sem acesso.' }, { status: 403 }));
    }

    const { data: agency } = await supabase
      .from('agencies')
      .select('slug')
      .eq('id', agencyUser.agencyId)
      .maybeSingle();

    if (!agency || agency.slug.toLowerCase() !== PLATFORM_OWNER_AGENCY_SLUG || agencyUser.role !== 'OWNER') {
      await supabase.auth.signOut();
      return applyCookies(NextResponse.json({ error: 'Acesso de plataforma negado.' }, { status: 403 }));
    }

    await touchAgencyUserLastLogin(agencyUser.id);

    return applyCookies(NextResponse.json({ ok: true }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: 'Erro ao autenticar.' }, { status: 500 });
  }
}
