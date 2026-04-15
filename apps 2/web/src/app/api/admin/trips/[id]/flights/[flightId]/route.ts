import { NextRequest, NextResponse } from 'next/server';
import { FlightStatus } from '@prisma/client';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  getTripOrThrow,
  mergeOperationMetadata,
  parseOptionalDate,
  parseRequiredDate,
  readOperationMetadata,
  resolvePassengerContext,
  toNullableString,
} from '@/modules/trips/operations';
import {
  appendFlightStatusSnapshot,
  registerAeroDataBoxSubscription,
} from '@/modules/integrations/aerodatabox/service';

const FlightSchema = z.object({
  airlineName: z.string().min(1),
  airlineCode: z.string().min(1),
  flightNumber: z.string().min(1),
  bookingReference: z.string().optional().or(z.literal('')),
  iataCode: z.string().optional().or(z.literal('')),
  origin: z.string().min(3),
  destination: z.string().min(3),
  departureAt: z.string(),
  arrivalAt: z.string(),
  actualDepartureAt: z.string().optional().or(z.literal('')),
  actualArrivalAt: z.string().optional().or(z.literal('')),
  terminal: z.string().optional().or(z.literal('')),
  gate: z.string().optional().or(z.literal('')),
  statusCode: z.nativeEnum(FlightStatus).optional().default('SCHEDULED'),
  passengerId: z.string().optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; flightId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.flightSegment.findFirst({
      where: { id: params.flightId, tripId: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Voo nao encontrado' }, { status: 404 });
    }

    const body = FlightSchema.parse(await req.json());
    const passenger = await resolvePassengerContext(session.user.agencyId, body.passengerId);
    const meta = readOperationMetadata<Record<string, unknown>>(existing.structuredMetadata);
    const bookingReference = toNullableString(body.bookingReference);
    const terminal = toNullableString(body.terminal);
    const gate = toNullableString(body.gate);
    const tripItemId = typeof meta.tripItemId === 'string' ? meta.tripItemId : null;

    const item = await prisma.$transaction(async (tx) => {
      const updatedFlight = await tx.flightSegment.update({
        where: { id: params.flightId },
        data: {
          airline: body.airlineCode.trim().toUpperCase(),
          airlineName: body.airlineName.trim(),
          flightNumber: body.flightNumber.trim(),
          origin: body.origin.trim().toUpperCase(),
          destination: body.destination.trim().toUpperCase(),
          departureAt: parseRequiredDate(body.departureAt),
          arrivalAt: parseRequiredDate(body.arrivalAt),
          actualDepartureAt: parseOptionalDate(body.actualDepartureAt),
          actualArrivalAt: parseOptionalDate(body.actualArrivalAt),
          departureTerminal: terminal,
          departureGate: gate,
          statusCode: body.statusCode,
          structuredMetadata: mergeOperationMetadata(meta as never, {
            bookingReference,
            iataCode: toNullableString(body.iataCode),
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
            title: `${body.airlineName.trim()} ${body.flightNumber.trim()}`.trim(),
            providerName: body.airlineName.trim(),
            startAt: updatedFlight.departureAt,
            endAt: updatedFlight.arrivalAt,
            location: `${body.origin.trim().toUpperCase()} -> ${body.destination.trim().toUpperCase()}`,
            confirmationCode: bookingReference,
            description: [
              terminal ? `Terminal ${terminal}` : null,
              gate ? `Portao ${gate}` : null,
              body.statusCode ? `Status ${body.statusCode}` : null,
            ].filter(Boolean).join(' · ') || null,
          },
        });
      }

      return updatedFlight;
    });

    await appendFlightStatusSnapshot({
      flightId: item.id,
      provider: 'MANUAL',
      externalStatus: item.statusCode,
      summary: 'Voo atualizado manualmente na operacao.',
      observedAt: new Date(),
      actualDepartureAt: item.actualDepartureAt,
      actualArrivalAt: item.actualArrivalAt,
    });

    const registration = await registerAeroDataBoxSubscription(item.id);

    return NextResponse.json({ ...item, monitoring: registration });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') {
      return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'PASSENGER_NOT_FOUND') {
      return NextResponse.json({ error: 'Passageiro nao encontrado' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'INVALID_DATE') {
      return NextResponse.json({ error: 'Data invalida.' }, { status: 422 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; flightId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.flightSegment.findFirst({
      where: { id: params.flightId, tripId: params.id },
      select: { id: true, structuredMetadata: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Voo nao encontrado' }, { status: 404 });
    }

    const meta = readOperationMetadata<Record<string, unknown>>(existing.structuredMetadata);
    const tripItemId = typeof meta.tripItemId === 'string' ? meta.tripItemId : null;

    await prisma.$transaction(async (tx) => {
      if (tripItemId) {
        await tx.tripItem.deleteMany({
          where: { id: tripItemId, tripId: params.id, agencyId: session.user.agencyId },
        });
      }

      await tx.flightSegment.delete({
        where: { id: params.flightId },
      });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') {
      return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
