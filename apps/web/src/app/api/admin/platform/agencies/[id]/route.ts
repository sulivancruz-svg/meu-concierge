import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformOwner } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePlatformOwner();

    if (params.id === session.user.agencyId) {
      return NextResponse.json({ error: 'Nao e permitido excluir a agencia atual por esta tela.' }, { status: 409 });
    }

    const agency = await prisma.agency.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        slug: true,
        users: {
          where: { deletedAt: null },
          select: { authUserId: true },
        },
        passengers: {
          where: { deletedAt: null },
          select: { authUserId: true },
        },
      },
    });

    if (!agency) {
      return NextResponse.json({ error: 'Agencia nao encontrada.' }, { status: 404 });
    }

    const authUserIds = [
      ...agency.users.map((user) => user.authUserId).filter(Boolean),
      ...agency.passengers.map((passenger) => passenger.authUserId).filter(Boolean),
    ] as string[];

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { agencyId: agency.id } });
      await tx.conversation.deleteMany({ where: { agencyId: agency.id } });
      await tx.document.deleteMany({ where: { agencyId: agency.id } });
      await tx.alert.deleteMany({ where: { agencyId: agency.id } });
      await tx.trip.deleteMany({ where: { agencyId: agency.id } });
      await tx.passengerCompanion.deleteMany({ where: { agencyId: agency.id } });
      await tx.passenger.deleteMany({ where: { agencyId: agency.id } });
      await tx.agencyUser.deleteMany({ where: { agencyId: agency.id } });
      await tx.agency.delete({ where: { id: agency.id } });
    });

    if (authUserIds.length > 0) {
      const supabase = createSupabaseServiceRoleClient();
      await Promise.all(authUserIds.map(async (authUserId) => {
        try {
          await supabase.auth.admin.deleteUser(authUserId);
        } catch {
          // Avoid failing the full deletion after data has already been removed.
        }
      }));
    }

    await createAuditLog({
      agencyId: session.user.agencyId,
      userId: session.user.id,
      action: 'platform.agency.deleted',
      entityType: 'agency',
      entityId: agency.id,
      meta: {
        slug: agency.slug,
        name: agency.name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Erro ao excluir a agencia.' }, { status: 500 });
  }
}
