import { NextRequest, NextResponse } from 'next/server';
import { Prisma, TripStatus } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isTripActiveForWhatsApp, mergeTripOperationalMeta, readTripOperationalMeta } from '@/modules/trips/trip-meta';

const CreateSchema = z.object({
  title: z.string().min(2),
  internalCode: z.string().optional().or(z.literal('')),
  destination: z.string().optional().or(z.literal('')),
  startDate: z.string(),
  endDate: z.string(),
  status: z.nativeEnum(TripStatus).optional().default('DRAFT'),
  notes: z.string().optional().or(z.literal('')),
  activeForWhatsApp: z.boolean().optional().default(false),
  passengerIds: z.array(z.string()).optional().default([]),
});

function toNullableString(value?: string) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('INVALID_DATE');
  }

  return date;
}

function parseSearchDate(search: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(search.trim())) {
    return null;
  }

  const start = new Date(`${search.trim()}T00:00:00.000Z`);
  const end = new Date(`${search.trim()}T23:59:59.999Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
}

async function buildTripPassengerPayload(agencyId: string, passengerIds: string[]) {
  const deduped = Array.from(new Set(passengerIds));
  if (!deduped.length) {
    return [];
  }

  const passengers = await prisma.passenger.findMany({
    where: {
      agencyId,
      deletedAt: null,
      id: { in: deduped },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      passportNumber: true,
    },
  });

  const passengerMap = new Map(passengers.map((passenger) => [passenger.id, passenger]));

  return deduped
    .map((passengerId, index) => {
      const passenger = passengerMap.get(passengerId);
      if (!passenger) {
        return null;
      }

      return {
        passengerId: passenger.id,
        name: passenger.name,
        email: passenger.email,
        phone: passenger.phone,
        passportNumber: passenger.passportNumber,
        isLead: index === 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function mapTripItem<T extends { structuredMetadata: Prisma.JsonValue | null }>(trip: T) {
  const operational = readTripOperationalMeta(trip.structuredMetadata);

  return {
    ...trip,
    internalCode: operational.internalCode,
    activeForWhatsApp: isTripActiveForWhatsApp(trip),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') ?? '';
    const status = searchParams.get('status') ?? '';
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const searchDate = parseSearchDate(search);

    const orFilters: Prisma.TripWhereInput[] = [];
    if (search) {
      orFilters.push(
        { title: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
        {
          structuredMetadata: {
            path: ['internalCode'],
            string_contains: search,
          },
        },
      );
    }

    if (searchDate) {
      orFilters.push(
        { startDate: { gte: searchDate.start, lte: searchDate.end } },
        { endDate: { gte: searchDate.start, lte: searchDate.end } },
      );
    }

    const where: Prisma.TripWhereInput = {
      agencyId: session.user.agencyId,
      ...(status ? { status: status as TripStatus } : {}),
      ...(orFilters.length ? { OR: orFilters } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          passengers: {
            include: {
              passenger: { select: { id: true, name: true, phone: true } },
            },
          },
          _count: { select: { documents: true, conversations: true } },
        },
      }),
      prisma.trip.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(mapTripItem),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
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
    const body = CreateSchema.parse(await req.json());
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);
    const passengers = await buildTripPassengerPayload(session.user.agencyId, body.passengerIds);

    const trip = await prisma.$transaction(async (tx) => {
      return tx.trip.create({
        data: {
          agencyId: session.user.agencyId,
          createdById: session.user.id,
          title: body.title.trim(),
          destination: toNullableString(body.destination),
          startDate,
          endDate,
          status: body.status,
          internalNotes: toNullableString(body.notes),
          isActiveForWhatsapp: body.activeForWhatsApp,
          structuredMetadata: mergeTripOperationalMeta(null, {
            internalCode: toNullableString(body.internalCode),
            activeForWhatsApp: body.activeForWhatsApp,
          }),
          passengers: passengers.length
            ? {
                create: passengers.map((passenger) => ({
                  passengerId: passenger.passengerId,
                  name: passenger.name,
                  email: passenger.email,
                  phone: passenger.phone,
                  passportNumber: passenger.passportNumber,
                  isLead: passenger.isLead,
                })),
              }
            : undefined,
        },
        include: {
          passengers: {
            include: {
              passenger: { select: { id: true, name: true, phone: true, email: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(mapTripItem(trip), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }

    if (error instanceof Error && error.message === 'INVALID_DATE') {
      return NextResponse.json({ error: 'Data invalida.' }, { status: 422 });
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
