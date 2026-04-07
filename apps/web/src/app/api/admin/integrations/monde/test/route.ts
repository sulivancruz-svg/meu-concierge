import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decryptMondePassword } from '@/modules/integrations/monde/crypto';
import { testMondeConnection } from '@/modules/integrations/monde/client';

const TestSchema = z.object({
  login: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = TestSchema.parse(await req.json().catch(() => ({})));

    let login: string;
    let password: string;

    if (body.login && body.password) {
      // Test with provided credentials
      login = body.login;
      password = body.password;
    } else {
      // Test with saved credentials
      const agency = await prisma.agency.findUniqueOrThrow({
        where: { id: session.user.agencyId },
        select: { mondeLogin: true, mondePasswordEnc: true },
      });

      if (!agency.mondeLogin || !agency.mondePasswordEnc) {
        return NextResponse.json(
          { ok: false, error: 'Credenciais do Monde nao configuradas' },
          { status: 400 },
        );
      }

      login = agency.mondeLogin;
      password = decryptMondePassword(agency.mondePasswordEnc);
    }

    const result = await testMondeConnection(login, password);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 });
  }
}
