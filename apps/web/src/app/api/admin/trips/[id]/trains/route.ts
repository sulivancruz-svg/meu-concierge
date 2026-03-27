import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow, mergeOperationMetadata, parseRequiredDate, resolvePassengerContext, toNullableString } from '@/modules/trips/operations';

const TrainSchema = z.object({
  provider: z.string().min(1),
  trainNumber: z.string().optional().or(z.literal('')),
  origin: z.string().min(1),
  destination: z.string().min(1),
  departureAt: z.string(),
  arrivalAt: z.string(),
  bookingReference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  passengerId: z.string().optional().or(z.literal('')),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const items = await prisma.trainBooking.findMany({ where: { tripId: params.id }, orderBy: { departureAt: 'asc' } });
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const body = TrainSchema.parse(await req.json());
    const passenger = await resolvePassengerContext(session.user.agencyId, body.passengerId);
    const item = await prisma.trainBooking.create({
      data: {
        tripId: params.id,
        operator: body.provider.trim(),
        trainNumber: toNullableString(body.trainNumber),
        origin: body.origin.trim(),
        destination: body.destination.trim(),
        departureAt: parseRequiredDate(body.departureAt),
        arrivalAt: parseRequiredDate(body.arrivalAt),
        confirmationCode: toNullableString(body.bookingReference),
        notes: toNullableString(body.notes),
        structuredMetadata: mergeOperationMetadata(null, {
          passengerId: passenger.passengerId,
          passengerName: passenger.passengerName,
        }),
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 422 });
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    if (error instanceof Error && error.message === 'PASSENGER_NOT_FOUND') return NextResponse.json({ error: 'Passageiro nao encontrado' }, { status: 404 });
    if (error instanceof Error && error.message === 'INVALID_DATE') return NextResponse.json({ error: 'Data invalida.' }, { status: 422 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
