import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { deleteStoredObject } from '@/lib/storage';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; documentId: string } }) {
  try {
    const session = await requireAdmin();
    const document = await prisma.document.findFirst({
      where: {
        id: params.documentId,
        tripId: params.id,
        agencyId: session.user.agencyId,
        deletedAt: null,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento nao encontrado' }, { status: 404 });
    }

    await deleteStoredObject(document.storagePath).catch(() => null);
    await prisma.document.update({
      where: { id: document.id },
      data: { deletedAt: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
