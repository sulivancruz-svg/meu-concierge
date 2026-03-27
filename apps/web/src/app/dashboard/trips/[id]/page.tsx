import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PencilLine } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TripDocumentsManager } from '@/components/trips/trip-documents-manager';
import { TripOperationsManager } from '@/components/trips/trip-operations-manager';
import { DeleteResourceButton } from '@/components/ui/delete-resource-button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { serializeTripDocuments } from '@/modules/documents/document-presentation';
import { getTripStatusLabel, getTripStatusTone, isTripActiveForWhatsApp } from '@/modules/trips/trip-meta';
import { ActivateButton } from './_components/activate-button';

function formatDateRange(startDate: Date, endDate: Date) {
  return `${format(startDate, "dd 'de' MMM", { locale: ptBR })} até ${format(endDate, "dd 'de' MMM yyyy", { locale: ptBR })}`;
}

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { saved?: string; updated?: string };
}) {
  const session = await getSession();
  if (!session) return null;

  const trip = await prisma.trip.findFirst({
    where: { id: params.id, agencyId: session.user.agencyId },
    include: {
      passengers: { include: { passenger: true } },
      flightSegments: { orderBy: { departureAt: 'asc' } },
      hotelBookings: { orderBy: { checkIn: 'asc' } },
      transportBookings: { orderBy: { scheduledAt: 'asc' } },
      tourBookings: { orderBy: { scheduledAt: 'asc' } },
      trainBookings: { orderBy: { departureAt: 'asc' } },
      insurancePolicies: { orderBy: { startDate: 'asc' } },
      notes: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { name: true } } },
      },
      documents: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { name: true } } },
      },
      conversations: {
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
        include: {
          passenger: { select: { name: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  });

  if (!trip) notFound();

  const successMessage = searchParams?.saved
    ? 'Viagem criada com sucesso.'
    : searchParams?.updated
      ? 'Viagem atualizada com sucesso.'
      : null;

  const passengerOptions = trip.passengers
    .filter((p) => p.passengerId && p.passenger)
    .map((p) => ({ value: p.passengerId as string, label: p.passenger?.name ?? p.name }));

  const tripDocuments = await serializeTripDocuments(trip.documents);
  const serializedDocuments = tripDocuments.map((doc) => ({
    ...doc,
    passengerName: trip.passengers.find((p) => p.passengerId === doc.passengerId)?.passenger?.name ?? null,
    fileUrl: doc.downloadUrl,
    uploadedBy: null,
  }));
  const entityOptions = [
    ...trip.flightSegments.map((item) => ({
      type: 'flight',
      value: item.id,
      label: `${item.airlineName || item.airline} ${item.flightNumber}`,
    })),
    ...trip.hotelBookings.map((item) => ({
      type: 'hotel',
      value: item.id,
      label: item.hotelName,
    })),
    ...trip.transportBookings.map((item) => ({
      type: 'transport',
      value: item.id,
      label: item.provider || item.name,
    })),
    ...trip.tourBookings.map((item) => ({
      type: 'tour',
      value: item.id,
      label: item.name,
    })),
    ...trip.trainBookings.map((item) => ({
      type: 'train',
      value: item.id,
      label: `${item.operator}${item.trainNumber ? ` ${item.trainNumber}` : ''}`,
    })),
    ...trip.insurancePolicies.map((item) => ({
      type: 'insurance',
      value: item.id,
      label: `${item.provider}${item.policyNumber ? ` ${item.policyNumber}` : ''}`,
    })),
  ];
  const activeForWhatsApp = isTripActiveForWhatsApp(trip);
  const operationalPassengers = trip.passengers
    .filter((p) => p.passengerId && p.passenger)
    .map((p) => ({ id: p.passengerId as string, name: p.passenger?.name ?? p.name }));

  const serializedFlights = trip.flightSegments.map((item) => ({
    ...item,
    departureAt: item.departureAt.toISOString(),
    arrivalAt: item.arrivalAt.toISOString(),
    actualDepartureAt: item.actualDepartureAt?.toISOString() ?? null,
    actualArrivalAt: item.actualArrivalAt?.toISOString() ?? null,
    lastCheckedAt: item.lastCheckedAt?.toISOString() ?? null,
  }));
  const serializedHotels = trip.hotelBookings.map((item) => ({
    ...item,
    checkIn: item.checkIn.toISOString(),
    checkOut: item.checkOut.toISOString(),
  }));
  const serializedTransports = trip.transportBookings.map((item) => ({
    ...item,
    scheduledAt: item.scheduledAt.toISOString(),
    rentalReturnAt: item.rentalReturnAt?.toISOString() ?? null,
  }));
  const serializedTours = trip.tourBookings.map((item) => ({
    ...item,
    scheduledAt: item.scheduledAt.toISOString(),
  }));
  const serializedTrains = trip.trainBookings.map((item) => ({
    ...item,
    departureAt: item.departureAt.toISOString(),
    arrivalAt: item.arrivalAt.toISOString(),
  }));
  const serializedInsurances = trip.insurancePolicies.map((item) => ({
    ...item,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate.toISOString(),
  }));
  const serializedNotes = trip.notes.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Viagem"
        title={trip.title}
        description={`${trip.destination || 'Destino não informado'} · ${formatDateRange(trip.startDate, trip.endDate)}`}
        actions={(
          <>
            <Link
              href={`/dashboard/trips/${trip.id}/edit`}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] transition hover:bg-[#f6f7f2]"
            >
              <PencilLine className="h-4 w-4" />
              Editar
            </Link>
            <DeleteResourceButton
              endpoint={`/api/admin/trips/${trip.id}`}
              redirectTo="/dashboard/trips?deleted=1"
              dialogTitle="Excluir viagem"
              dialogDescription="A viagem sera removida da operacao e nao aparecera mais nas listagens nem no atendimento."
              idleLabel="Excluir viagem"
              pendingLabel="Excluindo viagem..."
              successMessage="Viagem excluida com sucesso."
              errorMessage="Nao foi possivel excluir a viagem."
            />
            <ActivateButton tripId={trip.id} isActive={activeForWhatsApp} />
          </>
        )}
      />

      {/* WhatsApp active banner */}
      {activeForWhatsApp && (
        <div className="rounded-[20px] border border-[#cfe1cc] bg-[#ecf6ea] px-4 py-3 text-sm font-medium text-[#163020]">
          Viagem ativa para atendimento WhatsApp
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="rounded-[20px] border border-[#cfe1cc] bg-[#ecf6ea] px-4 py-3 text-sm font-medium text-[#163020]">
          {successMessage}
        </div>
      )}

      {/* Info + Passengers */}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Trip info */}
        <div className="rounded-[28px] border border-[#d9e2d5] bg-white p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Informações da viagem</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#7b857b]">Destino</p>
                <p className="mt-1 text-sm font-semibold text-[#142018]">{trip.destination || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#7b857b]">Período</p>
                <p className="mt-1 text-sm font-semibold text-[#142018]">{formatDateRange(trip.startDate, trip.endDate)}</p>
              </div>
              <div>
                <p className="text-xs text-[#7b857b]">Status</p>
                <div className="mt-1">
                  <StatusBadge tone={getTripStatusTone(trip.status)}>{getTripStatusLabel(trip.status)}</StatusBadge>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#7b857b]">Passageiros</p>
                <p className="mt-1 text-sm font-semibold text-[#142018]">{trip.passengers.length}</p>
              </div>
            </div>
            {trip.internalNotes && (
              <div className="rounded-2xl border border-[#edf1ea] bg-[#fbfcfa] p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#7b857b]">Observações internas</p>
                <p className="text-sm leading-6 text-[#38463a]">{trip.internalNotes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Passengers */}
        <div className="rounded-[28px] border border-[#d9e2d5] bg-white p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">
            Passageiros · {trip.passengers.length}
          </p>
          <div className="space-y-3">
            {trip.passengers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-4 py-8 text-center text-sm text-[#5b665d]">
                Nenhum passageiro vinculado.
              </div>
            ) : trip.passengers.map((passenger) => (
              <div key={passenger.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[#edf1ea] bg-[#fbfcfa] p-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-[#142018]">{passenger.passenger?.name ?? passenger.name}</p>
                    {passenger.isLead && <StatusBadge tone="info">Titular</StatusBadge>}
                  </div>
                  <p className="mt-0.5 text-xs text-[#7b857b]">
                    {passenger.phone || passenger.email || 'Sem contato'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TripOperationsManager
        tripId={trip.id}
        passengers={operationalPassengers}
        flights={serializedFlights}
        hotels={serializedHotels}
        transports={serializedTransports}
        tours={serializedTours}
        trains={serializedTrains}
        insurances={serializedInsurances}
        notes={serializedNotes}
      />

      {/* Documents */}
      <TripDocumentsManager
        tripId={trip.id}
        initialDocuments={serializedDocuments}
        passengerOptions={passengerOptions}
        entityOptions={entityOptions}
      />

      {/* Conversations */}
      {trip.conversations.length > 0 && (
        <div className="rounded-[28px] border border-[#d9e2d5] bg-white p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Conversas recentes</p>
          <div className="space-y-3">
            {trip.conversations.map((conversation) => (
              <div key={conversation.id} className="rounded-[20px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#142018]">{conversation.passenger?.name ?? conversation.phone}</p>
                    <p className="mt-1 text-sm text-[#5b665d]">{conversation.messages[0]?.body ?? 'Sem mensagem recente'}</p>
                  </div>
                  <StatusBadge tone={conversation.status === 'OPEN' ? 'warning' : 'neutral'}>{conversation.status}</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
