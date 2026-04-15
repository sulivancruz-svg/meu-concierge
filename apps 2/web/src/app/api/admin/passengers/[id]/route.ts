import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

const CompanionSchema = z.object({
  name: z.string().min(2),
  relationship: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

const UpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  passportNumber: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  companions: z.array(CompanionSchema).optional(),
});

function toNullableString(value?: string) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableDate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCompanionNotes(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const notes = (metadata as Record<string, unknown>).notes;
  return typeof notes === 'string' ? notes : null;
}

async function findPassenger(id: string, agencyId: string) {
  return prisma.passenger.findFirst({
    where: { id, agencyId, deletedAt: null },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const passenger = await prisma.passenger.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId, deletedAt: null },
      include: {
        companions: {
          orderBy: { name: 'asc' },
        },
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        tripPassengers: {
          include: {
            trip: {
              include: {
                documents: {
                  where: { deletedAt: null },
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
          orderBy: { trip: { startDate: 'desc' } },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!passenger) {
      return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      ...passenger,
      companions: passenger.companions.map((companion) => ({
        ...companion,
        notes: getCompanionNotes(companion.structuredMetadata),
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const passenger = await findPassenger(params.id, session.user.agencyId);

    if (!passenger) {
      return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 });
    }

    const body = UpdateSchema.parse(await req.json());

    const updated = await prisma.$transaction(async (tx) => {
      const nextPassenger = await tx.passenger.update({
        where: { id: params.id },
        data: {
          name: body.name?.trim() || undefined,
          email: body.email !== undefined ? toNullableString(body.email) : undefined,
          phone: body.phone !== undefined ? toNullableString(body.phone) : undefined,
          passportNumber: body.passportNumber !== undefined ? toNullableString(body.passportNumber) : undefined,
          dateOfBirth: body.dateOfBirth !== undefined ? toNullableDate(body.dateOfBirth) : undefined,
          notes: body.notes !== undefined ? toNullableString(body.notes) : undefined,
        },
      });

      if (body.companions) {
        await tx.passengerCompanion.deleteMany({
          where: { passengerId: params.id },
        });

        if (body.companions.length) {
          await tx.passengerCompanion.createMany({
            data: body.companions.map((companion) => ({
              agencyId: session.user.agencyId,
              passengerId: params.id,
              name: companion.name.trim(),
              relationship: toNullableString(companion.relationship),
              dateOfBirth: toNullableDate(companion.dateOfBirth),
              structuredMetadata: toNullableString(companion.notes)
                ? { notes: companion.notes?.trim() }
                : undefined,
            })),
          });
        }
      }

      return nextPassenger;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN']);
    const passenger = await findPassenger(params.id, session.user.agencyId);

    if (!passenger) {
      return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 });
    }

    await prisma.passenger.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
