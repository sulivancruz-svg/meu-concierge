import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow, mergeOperationMetadata, parseRequiredDate, readOperationMetadata, resolvePassengerContext, toNullableString } from '@/modules/trips/operations';

const HotelSchema = z.object({
  hotelName: z.string().min(1),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  checkIn: z.string(),
  checkOut: z.string(),
  bookingReference: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  passengerId: z.string().optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; hotelId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.hotelBooking.findFirst({ where: { id: params.hotelId, tripId: params.id } });
    if (!existing) return NextResponse.json({ error: 'Hotel nao encontrado' }, { status: 404 });
    const body = HotelSchema.parse(await req.json());
    const passenger = await resolvePassengerContext(session.user.agencyId, body.passengerId);
    const meta = readOperationMetadata<Record<string, unknown>>(existing.structuredMetadata);
    const city = toNullableString(body.city);
    const country = toNullableString(body.country);
    const bookingReference = toNullableString(body.bookingReference);
    const address = toNullableString(body.address);
    const notes = toNullableString(body.notes);
    const tripItemId = typeof meta.tripItemId === 'string' ? meta.tripItemId : null;

    const item = await prisma.$transaction(async (tx) => {
      const updatedHotel = await tx.hotelBooking.update({
        where: { id: params.hotelId },
        data: {
          hotelName: body.hotelName.trim(),
          address,
          checkIn: parseRequiredDate(body.checkIn),
          checkOut: parseRequiredDate(body.checkOut),
          confirmationCode: bookingReference,
          notes,
          structuredMetadata: mergeOperationMetadata(meta as never, {
            city,
            country,
            passengerId: passenger.passengerId,
            passengerName: passenger.passengerName,
          }),
        },
      });

      if (tripItemId) {
        await tx.tripItem.update({
          where: { id: tripItemId },
          data: {
            passengerId: passenger.passengerId,
            title: body.hotelName.trim(),
            providerName: body.hotelName.trim(),
            startAt: updatedHotel.checkIn,
            endAt: updatedHotel.checkOut,
            location: address || [city, country].filter(Boolean).join(', ') || null,
            confirmationCode: bookingReference,
            description: notes,
          },
        });
      }

      return updatedHotel;
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; hotelId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.hotelBooking.findFirst({
      where: { id: params.hotelId, tripId: params.id },
      select: { id: true, structuredMetadata: true },
    });
    if (!existing) return NextResponse.json({ error: 'Hotel nao encontrado' }, { status: 404 });

    const meta = readOperationMetadata<Record<string, unknown>>(existing.structuredMetadata);
    const tripItemId = typeof meta.tripItemId === 'string' ? meta.tripItemId : null;

    await prisma.$transaction(async (tx) => {
      if (tripItemId) {
        await tx.tripItem.deleteMany({
          where: { id: tripItemId, tripId: params.id, agencyId: session.user.agencyId },
        });
      }

      await tx.hotelBooking.delete({ where: { id: params.hotelId } });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
