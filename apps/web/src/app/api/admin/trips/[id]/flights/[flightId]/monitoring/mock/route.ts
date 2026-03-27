import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { handleAeroDataBoxWebhook } from '@/modules/integrations/aerodatabox/service';

const MockMonitoringSchema = z.object({
  status: z.enum(['SCHEDULED', 'ON_TIME', 'DELAYED', 'DEPARTED', 'LANDED', 'CANCELLED', 'DIVERTED', 'UNKNOWN']).default('DELAYED'),
  summary: z.string().optional().or(z.literal('')),
  departureGate: z.string().optional().or(z.literal('')),
  departureTerminal: z.string().optional().or(z.literal('')),
  arrivalGate: z.string().optional().or(z.literal('')),
  arrivalTerminal: z.string().optional().or(z.literal('')),
  actualDepartureAt: z.string().optional().or(z.literal('')),
  actualArrivalAt: z.string().optional().or(z.literal('')),
});

export async function POST(req: NextRequest, { params }: { params: { id: string; flightId: string } }) {
  try {
    const session = await requireAdmin();
    const flight = await prisma.flightSegment.findFirst({
      where: {
        id: params.flightId,
        tripId: params.id,
        trip: {
          agencyId: session.user.agencyId,
        },
      },
      select: {
        id: true,
        airline: true,
        flightNumber: true,
        departureGate: true,
        departureTerminal: true,
      },
    });

    if (!flight) {
      return NextResponse.json({ error: 'Voo nao encontrado' }, { status: 404 });
    }

    const body = MockMonitoringSchema.parse(await req.json().catch(() => ({})));
    const now = new Date();

    const applied = await handleAeroDataBoxWebhook({
      flightId: flight.id,
      flightNumber: `${flight.airline}${flight.flightNumber}`.replace(/\s+/g, '').toUpperCase(),
      status: body.status,
      summary: body.summary || `Evento simulado de monitoramento: ${body.status}.`,
      observedAt: now.toISOString(),
      departureGate: body.departureGate || flight.departureGate || null,
      departureTerminal: body.departureTerminal || flight.departureTerminal || null,
      arrivalGate: body.arrivalGate || null,
      arrivalTerminal: body.arrivalTerminal || null,
      actualDepartureAt: body.actualDepartureAt || null,
      actualArrivalAt: body.actualArrivalAt || null,
      source: 'admin-mock',
    });

    return NextResponse.json({ ok: true, applied });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 422 });
    }

    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
