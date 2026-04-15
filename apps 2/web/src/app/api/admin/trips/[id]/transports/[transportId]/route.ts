import { NextRequest, NextResponse } from 'next/server';
import { TransportType } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow, mergeOperationMetadata, parseOptionalDate, parseRequiredDate, readOperationMetadata, resolvePassengerContext, toNullableString } from '@/modules/trips/operations';

const TransportSchema = z.object({
  type: z.nativeEnum(TransportType),
  provider: z.string().optional().or(z.literal('')),
  departureLocation: z.string().min(1),
  arrivalLocation: z.string().min(1),
  startAt: z.string(),
  endAt: z.string().optional().or(z.literal('')),
  bookingReference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  passengerId: z.string().optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; transportId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.transportBooking.findFirst({ where: { id: params.transportId, tripId: params.id } });
    if (!existing) return NextResponse.json({ error: 'Transporte nao encontrado' }, { status: 404 });
    const body = TransportSchema.parse(await req.json());
    const passenger = await resolvePassengerContext(session.user.agencyId, body.passengerId);
    const meta = readOperationMetadata<Record<string, unknown>>(existing.structuredMetadata);

    const item = await prisma.transportBooking.update({
      where: { id: params.transportId },
      data: {
        type: body.type,
        name: toNullableString(body.provider) || body.type,
        provider: toNullableString(body.provider),
        pickupPoint: body.departureLocation.trim(),
        dropoffPoint: body.arrivalLocation.trim(),
        scheduledAt: parseRequiredDate(body.startAt),
        rentalReturnAt: parseOptionalDate(body.endAt),
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; transportId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    await prisma.transportBooking.delete({ where: { id: params.transportId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
