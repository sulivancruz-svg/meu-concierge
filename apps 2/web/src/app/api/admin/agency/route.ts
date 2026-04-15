import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/db';

const AgencyUpdateSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  supportEmail: z.string().email().optional().or(z.literal('')),
  supportPhone: z.string().optional().or(z.literal('')),
  supportWhatsApp: z.string().optional().or(z.literal('')),
});

function toNullableString(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN']);
    const body = AgencyUpdateSchema.parse(await request.json());
    const normalizedSlug = body.slug.trim().toLowerCase();

    const slugConflict = await prisma.agency.findFirst({
      where: {
        slug: normalizedSlug,
        id: { not: session.user.agencyId },
      },
      select: { id: true },
    });

    if (slugConflict) {
      return NextResponse.json({ error: 'Este slug ja esta em uso por outra agencia.' }, { status: 409 });
    }

    const agency = await prisma.agency.update({
      where: { id: session.user.agencyId },
      data: {
        name: body.name.trim(),
        slug: normalizedSlug,
        supportEmail: toNullableString(body.supportEmail),
        supportPhone: toNullableString(body.supportPhone),
        supportWhatsApp: toNullableString(body.supportWhatsApp),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        supportEmail: true,
        supportPhone: true,
        supportWhatsApp: true,
        status: true,
        plan: true,
      },
    });

    await createAuditLog({
      agencyId: session.user.agencyId,
      userId: session.user.id,
      action: 'agency.updated',
      entityType: 'agency',
      entityId: agency.id,
      meta: {
        slug: agency.slug,
        supportEmail: agency.supportEmail,
      },
    });

    return NextResponse.json(agency);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        {
          error: firstIssue?.message || 'Dados invalidos para atualizar a agencia.',
          details: error.flatten(),
        },
        { status: 422 },
      );
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Erro ao atualizar a agencia.' }, { status: 500 });
  }
}
