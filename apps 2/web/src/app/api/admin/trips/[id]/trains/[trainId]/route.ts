import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow, mergeOperationMetadata, parseRequiredDate, readOperationMetadata, resolvePassengerContext, toNullableString } from '@/modules/trips/operations';

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

export async function PATCH(req: NextRequest, { params }: { params: { id: string; trainId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.trainBooking.findFirst({ where: { id: params.trainId, tripId: params.id } });
    if (!existing) return NextResponse.json({ error: 'Trem nao encontrado' }, { status: 404 });
    const body = TrainSchema.parse(await req.json());
    const passenger = await resolvePassengerContext(session.user.agencyId, body.passengerId);
    const meta = readOperationMetadata<Record<string, unknown>>(existing.structuredMetadata);
    const item = await prisma.trainBooking.update({
      where: { id: params.trainId },
      data: {
        operator: body.provider.trim(),
        trainNumber: toNullableString(body.trainNumber),
        origin: body.origin.trim(),
        destination: body.destination.trim(),
        departureAt: parseRequiredDate(body.departureAt),
        arrivalAt: parseRequiredDate(body.arrivalAt),
        confirmationCode: toNullableString(body.bookingReference),
        notes: toNullableString(body.notes),
        structuredMetadata: mergeOperationMetadata(meta as never, {
          passengerId: passenger.passengerId,
          passengerName: passenger.passengerName,
        }),
      },
    });
    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors }, { status: 422 });
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    if (error instanceof Error && error.message === 'PASSENGER_NOT_FOUND') return NextResponse.json({ error: 'Passageiro nao encontrado' }, { status: 404 });
    if (error instanceof Error && error.message === 'INVALID_DATE') return NextResponse.json({ error: 'Data invalida.' }, { status: 422 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; trainId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    await prisma.trainBooking.delete({ where: { id: params.trainId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
