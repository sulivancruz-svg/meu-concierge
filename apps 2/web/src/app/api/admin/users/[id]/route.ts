import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

const UserActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reset_password'),
    password: z.string().min(8),
  }),
  z.object({
    action: z.literal('deactivate'),
  }),
  z.object({
    action: z.literal('activate'),
  }),
  z.object({
    action: z.literal('delete'),
  }),
]);

async function getTargetUser(userId: string, agencyId: string) {
  return prisma.agencyUser.findFirst({
    where: {
      id: userId,
      agencyId,
      deletedAt: null,
    },
    select: {
      id: true,
      authUserId: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN']);
    const body = UserActionSchema.parse(await request.json());
    const targetUser = await getTargetUser(params.id, session.user.agencyId);

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 });
    }

    if (targetUser.id === session.user.id && (body.action === 'deactivate' || body.action === 'delete')) {
      return NextResponse.json({ error: 'Voce nao pode remover o proprio acesso.' }, { status: 409 });
    }

    if (session.user.role !== 'OWNER' && targetUser.role === 'OWNER') {
      return NextResponse.json({ error: 'Apenas owners podem gerenciar outro owner.' }, { status: 403 });
    }

    if ((body.action === 'deactivate' || body.action === 'delete') && targetUser.role === 'OWNER') {
      const activeOwners = await prisma.agencyUser.count({
        where: {
          agencyId: session.user.agencyId,
          role: 'OWNER',
          status: 'ACTIVE',
          deletedAt: null,
        },
      });

      if (activeOwners <= 1) {
        return NextResponse.json({ error: 'A agencia precisa manter ao menos um owner ativo.' }, { status: 409 });
      }
    }

    const supabase = createSupabaseServiceRoleClient();

    if (body.action === 'reset_password') {
      if (!targetUser.authUserId) {
        return NextResponse.json({ error: 'Usuario sem vinculo no Supabase Auth.' }, { status: 409 });
      }

      const { error } = await supabase.auth.admin.updateUserById(targetUser.authUserId, {
        password: body.password,
      });

      if (error) {
        throw new Error(`SUPABASE_AUTH_UPDATE_FAILED:${error.message}`);
      }

      await createAuditLog({
        agencyId: session.user.agencyId,
        userId: session.user.id,
        action: 'agency_user.password_reset',
        entityType: 'agency_user',
        entityId: targetUser.id,
        meta: { email: targetUser.email },
      });

      return NextResponse.json({ ok: true });
    }

    if (body.action === 'delete') {
      if (targetUser.authUserId) {
        const { error } = await supabase.auth.admin.deleteUser(targetUser.authUserId);

        if (error) {
          throw new Error(`SUPABASE_AUTH_DELETE_FAILED:${error.message}`);
        }
      }

      await prisma.agencyUser.update({
        where: { id: targetUser.id },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          authUserId: null,
        },
      });

      await createAuditLog({
        agencyId: session.user.agencyId,
        userId: session.user.id,
        action: 'agency_user.deleted',
        entityType: 'agency_user',
        entityId: targetUser.id,
        meta: { email: targetUser.email },
      });

      return NextResponse.json({ ok: true });
    }

    const nextStatus = body.action === 'activate' ? 'ACTIVE' : 'INACTIVE';

    await prisma.agencyUser.update({
      where: { id: targetUser.id },
      data: { status: nextStatus },
    });

    await createAuditLog({
      agencyId: session.user.agencyId,
      userId: session.user.id,
      action: body.action === 'activate' ? 'agency_user.activated' : 'agency_user.deactivated',
      entityType: 'agency_user',
      entityId: targetUser.id,
      meta: { email: targetUser.email },
    });

    return NextResponse.json({ ok: true });
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

    return NextResponse.json({ error: 'Erro ao atualizar usuario.' }, { status: 500 });
  }
}
