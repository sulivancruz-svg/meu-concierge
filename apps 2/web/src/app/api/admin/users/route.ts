import { NextRequest, NextResponse } from 'next/server';
import { AgencyUserRole } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

const CreateAgencyUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(AgencyUserRole),
});

async function findSupabaseAuthUserByEmail(email: string) {
  const supabase = createSupabaseServiceRoleClient();
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      throw new Error(`SUPABASE_AUTH_LIST_FAILED:${error.message}`);
    }

    const matched = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (matched) {
      return matched;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

export async function GET() {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN']);
    const users = await prisma.agencyUser.findMany({
      where: {
        agencyId: session.user.agencyId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN']);
    const body = CreateAgencyUserSchema.parse(await request.json());
    const normalizedEmail = body.email.trim().toLowerCase();
    const normalizedName = body.name.trim();

    if (session.user.role !== 'OWNER' && body.role === 'OWNER') {
      return NextResponse.json({ error: 'Apenas owners podem criar outro owner.' }, { status: 403 });
    }

    const existingAgencyUser = await prisma.agencyUser.findFirst({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        agencyId: true,
        deletedAt: true,
        authUserId: true,
      },
    });

    if (existingAgencyUser && existingAgencyUser.agencyId !== session.user.agencyId) {
      return NextResponse.json({ error: 'Este email ja esta vinculado a outra agencia.' }, { status: 409 });
    }

    let authUserId = existingAgencyUser?.authUserId ?? null;
    const existingAuthUser = await findSupabaseAuthUserByEmail(normalizedEmail);
    const supabase = createSupabaseServiceRoleClient();

    if (existingAuthUser) {
      authUserId = existingAuthUser.id;

      const { error: updateError } = await supabase.auth.admin.updateUserById(existingAuthUser.id, {
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: normalizedName,
          role: body.role,
          user_type: 'agency_user',
          agency_id: session.user.agencyId,
        },
      });

      if (updateError) {
        throw new Error(`SUPABASE_AUTH_UPDATE_FAILED:${updateError.message}`);
      }
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: normalizedName,
          role: body.role,
          user_type: 'agency_user',
          agency_id: session.user.agencyId,
        },
      });

      if (error || !data.user) {
        throw new Error(`SUPABASE_AUTH_CREATE_FAILED:${error?.message ?? 'unknown error'}`);
      }

      authUserId = data.user.id;
    }

    const agencyUser = await prisma.agencyUser.upsert({
      where: {
        agencyId_email: {
          agencyId: session.user.agencyId,
          email: normalizedEmail,
        },
      },
      update: {
        authUserId,
        name: normalizedName,
        role: body.role,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        agencyId: session.user.agencyId,
        authUserId,
        name: normalizedName,
        email: normalizedEmail,
        role: body.role,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      agencyId: session.user.agencyId,
      userId: session.user.id,
      action: 'agency_user.created',
      entityType: 'agency_user',
      entityId: agencyUser.id,
      meta: {
        email: agencyUser.email,
        role: agencyUser.role,
      },
    });

    return NextResponse.json(agencyUser, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    if (error instanceof Error && error.message.includes('Missing Supabase environment variable')) {
      return NextResponse.json({ error: 'Supabase service role nao configurada.' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Erro ao criar usuario administrativo.' }, { status: 500 });
  }
}
