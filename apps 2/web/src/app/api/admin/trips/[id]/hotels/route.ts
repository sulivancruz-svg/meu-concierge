import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow, mergeOperationMetadata, parseRequiredDate, resolvePassengerContext, toNullableString } from '@/modules/trips/operations';

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const items = await prisma.hotelBooking.findMany({ where: { tripId: params.id }, orderBy: { checkIn: 'asc' } });
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') {
      return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const body = HotelSchema.parse(await req.json());
    const passenger = await resolvePassengerContext(session.user.agencyId, body.passengerId);
    const city = toNullableString(body.city);
    const country = toNullableString(body.country);
    const bookingReference = toNullableString(body.bookingReference);
    const address = toNullableString(body.address);
    const notes = toNullableString(body.notes);

    const item = await prisma.$transaction(async (tx) => {
      const createdHotel = await tx.hotelBooking.create({
        data: {
          tripId: params.id,
          hotelName: body.hotelName.trim(),
          address,
          checkIn: parseRequiredDate(body.checkIn),
          checkOut: parseRequiredDate(body.checkOut),
          confirmationCode: bookingReference,
          notes,
          structuredMetadata: mergeOperationMetadata(null, {
            city,
            country,
            passengerId: passenger.passengerId,
            passengerName: passenger.passengerName,
          }),
        },
      });

      const tripItem = await tx.tripItem.create({
        data: {
          agencyId: session.user.agencyId,
          tripId: params.id,
          passengerId: passenger.passengerId,
          type: 'HOTEL',
          title: body.hotelName.trim(),
          providerName: body.hotelName.trim(),
          startAt: createdHotel.checkIn,
          endAt: createdHotel.checkOut,
          location: address || [city, country].filter(Boolean).join(', ') || null,
          confirmationCode: bookingReference,
          description: notes,
          details: {
            sourceType: 'hotelBooking',
            sourceId: createdHotel.id,
          },
        },
      });

      return tx.hotelBooking.update({
        where: { id: createdHotel.id },
        data: {
          structuredMetadata: mergeOperationMetadata(createdHotel.structuredMetadata, {
            tripItemId: tripItem.id,
          }),
        },
      });
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
