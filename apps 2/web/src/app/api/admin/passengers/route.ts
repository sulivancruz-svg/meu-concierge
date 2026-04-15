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

const PassengerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  passportNumber: z.string().optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  companions: z.array(CompanionSchema).optional().default([]),
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

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') ?? '';
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

    const where = {
      agencyId: session.user.agencyId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.passenger.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              tripPassengers: true,
              companions: true,
              conversations: true,
            },
          },
          tripPassengers: {
            include: {
              trip: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  startDate: true,
                },
              },
            },
            orderBy: { trip: { startDate: 'desc' } },
            take: 1,
          },
        },
      }),
      prisma.passenger.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = PassengerSchema.parse(await req.json());

    const passenger = await prisma.passenger.create({
      data: {
        agencyId: session.user.agencyId,
        name: body.name.trim(),
        email: toNullableString(body.email),
        phone: toNullableString(body.phone),
        passportNumber: toNullableString(body.passportNumber),
        dateOfBirth: toNullableDate(body.dateOfBirth),
        notes: toNullableString(body.notes),
        companions: body.companions.length
          ? {
              create: body.companions.map((companion) => ({
                agencyId: session.user.agencyId,
                name: companion.name.trim(),
                relationship: toNullableString(companion.relationship),
                dateOfBirth: toNullableDate(companion.dateOfBirth),
                structuredMetadata: toNullableString(companion.notes)
                  ? { notes: companion.notes?.trim() }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: {
        companions: true,
      },
    });

    return NextResponse.json(passenger, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
