import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isTripActiveForWhatsApp, mergeTripOperationalMeta, readTripOperationalMeta } from '@/modules/trips/trip-meta';

const UpdateSchema = z.object({
  title: z.string().min(2).optional(),
  internalCode: z.string().optional().or(z.literal('')),
  destination: z.string().optional().or(z.literal('')),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['DRAFT', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional().or(z.literal('')),
  activeForWhatsApp: z.boolean().optional(),
  passengerIds: z.array(z.string()).optional(),
});

async function findTrip(id: string, agencyId: string) {
  return prisma.trip.findFirst({ where: { id, agencyId } });
}

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

function mapTripDetail<T extends { structuredMetadata: Prisma.JsonValue | null }>(trip: T) {
  const operational = readTripOperationalMeta(trip.structuredMetadata);

  return {
    ...trip,
    internalCode: operational.internalCode,
    activeForWhatsApp: isTripActiveForWhatsApp(trip),
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const trip = await prisma.trip.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
      include: {
        passengers: { include: { passenger: true } },
        flightSegments: { orderBy: { departureAt: 'asc' } },
        hotelBookings: { orderBy: { checkIn: 'asc' } },
        transportBookings: { orderBy: { scheduledAt: 'asc' } },
        tourBookings: { orderBy: { scheduledAt: 'asc' } },
        trainBookings: { orderBy: { departureAt: 'asc' } },
        insurancePolicies: true,
        documents: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { id: true, name: true } } },
        },
        alerts: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          include: {
            passenger: { select: { id: true, name: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 3 },
          },
        },
        _count: { select: { conversations: true, alerts: true, documents: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 });
    }

    return NextResponse.json(mapTripDetail(trip));
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const trip = await findTrip(params.id, session.user.agencyId);
    if (!trip) {
      return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 });
    }

    const body = UpdateSchema.parse(await req.json());
    const currentMeta = readTripOperationalMeta(trip.structuredMetadata);
    const passengers = body.passengerIds
      ? await buildTripPassengerPayload(session.user.agencyId, body.passengerIds)
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const nextTrip = await tx.trip.update({
        where: { id: params.id },
        data: {
          title: body.title?.trim(),
          destination: body.destination !== undefined ? toNullableString(body.destination) : undefined,
          startDate: body.startDate ? parseDate(body.startDate) : undefined,
          endDate: body.endDate ? parseDate(body.endDate) : undefined,
          status: body.status,
          internalNotes: body.notes !== undefined ? toNullableString(body.notes) : undefined,
          isActiveForWhatsapp: body.activeForWhatsApp ?? trip.isActiveForWhatsapp,
          structuredMetadata: mergeTripOperationalMeta(trip.structuredMetadata, {
            internalCode: body.internalCode !== undefined ? toNullableString(body.internalCode) : currentMeta.internalCode,
            activeForWhatsApp: body.activeForWhatsApp ?? currentMeta.activeForWhatsApp,
          }),
        },
      });

      if (passengers) {
        await tx.tripPassenger.deleteMany({
          where: { tripId: params.id },
        });

        if (passengers.length) {
          await tx.tripPassenger.createMany({
            data: passengers.map((passenger) => ({
              tripId: params.id,
              passengerId: passenger.passengerId,
              name: passenger.name,
              email: passenger.email,
              phone: passenger.phone,
              passportNumber: passenger.passportNumber,
              isLead: passenger.isLead,
            })),
          });
        }
      }

      return nextTrip;
    });

    return NextResponse.json(mapTripDetail(updated));
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN']);
    const trip = await findTrip(params.id, session.user.agencyId);
    if (!trip) {
      return NextResponse.json({ error: 'Nao encontrado' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.alert.deleteMany({
        where: { tripId: params.id },
      });

      await tx.conversation.deleteMany({
        where: { tripId: params.id },
      });

      await tx.trip.delete({
        where: { id: params.id },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
