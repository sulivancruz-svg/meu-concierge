import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encryptMondePassword } from '@/modules/integrations/monde/crypto';

const CredentialsSchema = z.object({
  login: z.string().min(1, 'Login obrigatorio'),
  password: z.string().min(1, 'Senha obrigatoria'),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = CredentialsSchema.parse(await req.json());

    const encrypted = encryptMondePassword(body.password);

    await prisma.agency.update({
      where: { id: session.user.agencyId },
      data: {
        mondeLogin: body.login.trim(),
        mondePasswordEnc: encrypted,
        mondeEnabled: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? 'Dados invalidos' },
        { status: 422 },
      );
    }
    if (error instanceof Error && error.message.includes('MONDE_ENCRYPTION_KEY')) {
      return NextResponse.json(
        { error: 'Chave de criptografia nao configurada no servidor' },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await requireAdmin();

    await prisma.agency.update({
      where: { id: session.user.agencyId },
      data: {
        mondeLogin: null,
        mondePasswordEnc: null,
        mondeEnabled: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
