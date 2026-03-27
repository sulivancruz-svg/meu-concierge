import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readOperationMetadata } from '@/modules/trips/operations';

type FlightLookupMeta = {
  bookingReference?: string;
};

function normalizeCode(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

function buildDescription(input: {
  origin: string;
  destination: string;
  departureTerminal: string | null;
  departureGate: string | null;
  statusCode: string;
}) {
  const parts = [
    `${input.origin} -> ${input.destination}`,
    input.departureTerminal ? `Terminal ${input.departureTerminal}` : null,
    input.departureGate ? `Portao ${input.departureGate}` : null,
    input.statusCode ? `Status ${input.statusCode.replace(/_/g, ' ')}` : null,
  ].filter(Boolean);

  return parts.join(' · ');
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const confirmationCode = req.nextUrl.searchParams.get('confirmationCode')?.trim() || '';

    if (!confirmationCode) {
      return NextResponse.json({ error: 'Localizador obrigatorio.' }, { status: 422 });
    }

    const trip = await prisma.trip.findFirst({
      where: { id: params.id, agencyId: session.user.agencyId },
      select: { id: true },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    }

    const flights = await prisma.flightSegment.findMany({
      where: { tripId: params.id },
      orderBy: { departureAt: 'asc' },
    });

    const code = normalizeCode(confirmationCode);
    const flight = flights.find((item) => {
      const meta = readOperationMetadata<FlightLookupMeta>(item.structuredMetadata);
      return meta.bookingReference ? normalizeCode(meta.bookingReference) === code : false;
    });

    if (!flight) {
      return NextResponse.json({ error: 'Nenhum voo encontrado para esse localizador.' }, { status: 404 });
    }

    const meta = readOperationMetadata<FlightLookupMeta>(flight.structuredMetadata);
    const airlineLabel = flight.airlineName || flight.airline;

    return NextResponse.json({
      title: `${airlineLabel} ${flight.flightNumber}`.trim(),
      providerName: airlineLabel,
      startAt: flight.departureAt.toISOString(),
      endAt: flight.arrivalAt.toISOString(),
      location: `${flight.origin} -> ${flight.destination}`,
      confirmationCode: meta.bookingReference || confirmationCode,
      description: buildDescription({
        origin: flight.origin,
        destination: flight.destination,
        departureTerminal: flight.departureTerminal,
        departureGate: flight.departureGate,
        statusCode: flight.statusCode,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
