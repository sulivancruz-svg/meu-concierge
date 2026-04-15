import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTripOrThrow, mergeOperationMetadata, parseRequiredDate, readOperationMetadata, resolvePassengerContext, toNullableString } from '@/modules/trips/operations';

const InsuranceSchema = z.object({
  provider: z.string().min(1),
  policyNumber: z.string().optional().or(z.literal('')),
  emergencyPhone: z.string().optional().or(z.literal('')),
  coverageSummary: z.string().optional().or(z.literal('')),
  validFrom: z.string(),
  validUntil: z.string(),
  notes: z.string().optional().or(z.literal('')),
  passengerId: z.string().optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; insuranceId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    const existing = await prisma.insurancePolicy.findFirst({ where: { id: params.insuranceId, tripId: params.id } });
    if (!existing) return NextResponse.json({ error: 'Seguro nao encontrado' }, { status: 404 });
    const body = InsuranceSchema.parse(await req.json());
    const passenger = await resolvePassengerContext(session.user.agencyId, body.passengerId);
    const meta = readOperationMetadata<Record<string, unknown>>(existing.structuredMetadata);
    const item = await prisma.insurancePolicy.update({
      where: { id: params.insuranceId },
      data: {
        provider: body.provider.trim(),
        policyNumber: toNullableString(body.policyNumber),
        emergencyPhone: toNullableString(body.emergencyPhone),
        coverageType: toNullableString(body.coverageSummary),
        startDate: parseRequiredDate(body.validFrom),
        endDate: parseRequiredDate(body.validUntil),
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; insuranceId: string } }) {
  try {
    const session = await requireAdmin();
    await getTripOrThrow(params.id, session.user.agencyId);
    await prisma.insurancePolicy.delete({ where: { id: params.insuranceId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIP_NOT_FOUND') return NextResponse.json({ error: 'Viagem nao encontrada' }, { status: 404 });
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
