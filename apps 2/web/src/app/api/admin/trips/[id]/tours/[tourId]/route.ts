import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow, mergeOperationMetadata, parseOptionalDate, parseRequiredDate, readOperationMetadata, resolvePassengerContext, toNullableString } from '@/modules/trips/operations';

const TourSchema = z.object({
  title: z.string().min(1),
  provider: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  startAt: z.string(),
  endAt: z.string().optional().or(z.literal('')),
  bookingReference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  passengerId: z.string().optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; tourId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.tourBooking.findFirst({ where: { id: params.tourId, tripId: params.id } });
    if (!existing) return NextResponse.json({ error: 'Passeio nao encontrado' }, { status: 404 });
    const body = TourSchema.parse(await req.json());
    const passenger = await resolvePassengerContext(session.user.agencyId, body.passengerId);
    const meta = readOperationMetadata<Record<string, unknown>>(existing.structuredMetadata);
    const item = await prisma.tourBooking.update({
      where: { id: params.tourId },
      data: {
        name: body.title.trim(),
        provider: toNullableString(body.provider),
        meetingPoint: toNullableString(body.location),
        scheduledAt: parseRequiredDate(body.startAt),
        confirmationCode: toNullableString(body.bookingReference),
        notes: toNullableString(body.notes),
        structuredMetadata: mergeOperationMetadata(meta as never, {
          endAt: body.endAt ? parseOptionalDate(body.endAt)?.toISOString() ?? null : null,
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; tourId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    await prisma.tourBooking.delete({ where: { id: params.tourId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
