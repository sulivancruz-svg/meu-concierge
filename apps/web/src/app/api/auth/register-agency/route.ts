import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformOwner } from '@/lib/auth';
import { createSupabaseRouteHandlerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

const RegisterAgencySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('self_serve'),
    agencyName: z.string().min(2),
    ownerName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  }),
  z.object({
    mode: z.literal('invite'),
    agencyName: z.string().min(2),
    ownerName: z.string().min(2),
    email: z.string().email(),
  }),
]);

function slugifyAgencyName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agencia';
}

async function generateUniqueAgencySlug(baseName: string) {
  const baseSlug = slugifyAgencyName(baseName);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.agency.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function findAuthUserByEmail(email: string) {
  const supabase = createSupabaseServiceRoleClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      throw new Error(`SUPABASE_AUTH_LIST_FAILED:${error.message}`);
    }

    const matched = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (matched) {
      return matched;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

export async function POST(request: NextRequest) {
  let createdAuthUserId: string | null = null;

  try {
    const body = RegisterAgencySchema.parse(await request.json());

    if (body.mode === 'invite') {
      await requirePlatformOwner();
    }

    const normalizedEmail = body.email.trim().toLowerCase();
    const normalizedAgencyName = body.agencyName.trim();
    const normalizedOwnerName = body.ownerName.trim();

    const existingAgencyUser = await prisma.agencyUser.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingAgencyUser) {
      return NextResponse.json({ error: 'Este email ja esta em uso na plataforma.' }, { status: 409 });
    }

    const existingAuthUser = await findAuthUserByEmail(normalizedEmail);
    if (existingAuthUser) {
      return NextResponse.json({ error: 'Este email ja esta cadastrado no auth.' }, { status: 409 });
    }

    const agencySlug = await generateUniqueAgencySlug(normalizedAgencyName);
    const supabaseAdmin = createSupabaseServiceRoleClient();
    const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

    let inviteLink: string | null = null;

    if (body.mode === 'self_serve') {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: normalizedOwnerName,
          role: 'OWNER',
          user_type: 'agency_user',
          agency_slug: agencySlug,
        },
      });

      if (authError || !authData.user) {
        throw new Error(`SUPABASE_AUTH_CREATE_FAILED:${authError?.message ?? 'unknown error'}`);
      }

      createdAuthUserId = authData.user.id;
    } else {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: normalizedEmail,
        options: {
          redirectTo: `${appUrl}/login`,
          data: {
            full_name: normalizedOwnerName,
            role: 'OWNER',
            user_type: 'agency_user',
            agency_slug: agencySlug,
          },
        },
      });

      if (inviteError || !inviteData.user || !inviteData.properties.action_link) {
        throw new Error(`SUPABASE_AUTH_INVITE_FAILED:${inviteError?.message ?? 'unknown error'}`);
      }

      createdAuthUserId = inviteData.user.id;
      inviteLink = inviteData.properties.action_link;
    }

    await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          slug: agencySlug,
          name: normalizedAgencyName,
          supportEmail: normalizedEmail,
          plan: 'STARTER',
          status: 'ACTIVE',
        },
      });

      await tx.agencyUser.create({
        data: {
          agencyId: agency.id,
          authUserId: createdAuthUserId,
          role: 'OWNER',
          name: normalizedOwnerName,
          email: normalizedEmail,
          status: 'ACTIVE',
        },
      });
    });

    if (body.mode === 'self_serve') {
      const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request);
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: body.password,
      });

      if (loginError || !loginData.user) {
        return NextResponse.json(
          {
            ok: true,
            created: true,
            mode: body.mode,
            ownerEmail: normalizedEmail,
            redirectTo: '/login',
          },
          { status: 201 },
        );
      }

      return applyCookies(
        NextResponse.json(
          {
            ok: true,
            created: true,
            mode: body.mode,
            ownerEmail: normalizedEmail,
            redirectTo: '/dashboard',
          },
          { status: 201 },
        ),
      );
    }

    return NextResponse.json(
      {
        ok: true,
        created: true,
        mode: body.mode,
        ownerEmail: normalizedEmail,
        inviteLink,
        redirectTo: '/login',
      },
      { status: 201 },
    );
  } catch (error) {
    if (createdAuthUserId) {
      try {
        const supabaseAdmin = createSupabaseServiceRoleClient();
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      } catch {
        // Avoid masking the original onboarding error.
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }

    if (error instanceof Error && error.message.includes('Missing Supabase environment variable')) {
      return NextResponse.json({ error: 'Supabase nao configurado no ambiente.' }, { status: 500 });
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Apenas a conta principal do SaaS pode criar agencias por aqui.' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Erro ao criar a nova agencia.' }, { status: 500 });
  }
}
