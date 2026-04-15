import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TripItemType } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildPassengerPortalEntryUrl } from '@/lib/portal-access';
import { PageHeader } from '@/components/ui/page-header';
import { DeleteResourceButton } from '@/components/ui/delete-resource-button';
import { PassengerHub, type PassengerHubData, type TripEntityOption } from '@/components/passengers/passenger-hub';

function getCompanionNotes(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const notes = (metadata as Record<string, unknown>).notes;
  return typeof notes === 'string' ? notes : null;
}

export default async function PassengerDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string; updated?: string };
}) {
  const session = await getSession();
  if (!session) return null;

  const passenger = await prisma.passenger.findFirst({
    where: { id: params.id, agencyId: session.user.agencyId, deletedAt: null },
    include: {
      companions: { orderBy: { name: 'asc' } },
      tripPassengers: {
        include: {
          trip: {
            include: {
              _count: { select: { documents: { where: { deletedAt: null } } } },
              tripItems: {
                orderBy: [{ startAt: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
              },
              flightSegments: { orderBy: { departureAt: 'asc' } },
              hotelBookings: { orderBy: { checkIn: 'asc' } },
              transportBookings: true,
              tourBookings: true,
              trainBookings: true,
              insurancePolicies: true,
            },
          },
        },
        orderBy: { trip: { startDate: 'desc' } },
      },
      conversations: {
        orderBy: { lastMessageAt: 'desc' },
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      },
    },
  });

  if (!passenger) notFound();

  const primaryTripLink = passenger.tripPassengers[0]
    ? buildPassengerPortalEntryUrl({
        tripId: passenger.tripPassengers[0].tripId,
        passengerId: passenger.id,
      })
    : null;

  // Build entity options per trip for document upload forms
  function buildEntityOptions(trip: NonNullable<typeof passenger>['tripPassengers'][number]['trip']): TripEntityOption[] {
    const tripItemIcons: Record<TripItemType, string> = {
      FLIGHT: '✈',
      HOTEL: '🏨',
      TRANSPORT: '🚌',
      TOUR: '🎟',
      TRAIN: '🚂',
      INSURANCE: '🛡',
      NOTE: '📝',
    };

    if (trip.tripItems.length > 0) {
      return trip.tripItems.map((item) => ({
        id: item.id,
        label: `${tripItemIcons[item.type]} ${item.title}`,
        type: 'trip_item',
      }));
    }

    const options: TripEntityOption[] = [];
    for (const f of trip.flightSegments) {
      options.push({ id: f.id, label: `✈ ${f.airlineName || f.airline} ${f.flightNumber}`, type: 'flight' });
    }
    for (const h of trip.hotelBookings) {
      options.push({ id: h.id, label: `🏨 ${h.hotelName}`, type: 'hotel' });
    }
    for (const t of trip.transportBookings) {
      options.push({ id: t.id, label: `🚌 ${t.provider || t.name}`, type: 'transport' });
    }
    for (const t of trip.tourBookings) {
      options.push({ id: t.id, label: `🎟 ${t.name}`, type: 'tour' });
    }
    for (const t of trip.trainBookings) {
      options.push({ id: t.id, label: `🚂 ${t.operator}${t.trainNumber ? ` ${t.trainNumber}` : ''}`, type: 'train' });
    }
    for (const i of trip.insurancePolicies) {
      options.push({ id: i.id, label: `🛡 ${i.provider}${i.policyNumber ? ` ${i.policyNumber}` : ''}`, type: 'insurance' });
    }
    return options;
  }

  const hubData: PassengerHubData = {
    id: passenger.id,
    name: passenger.name,
    phone: passenger.phone,
    email: passenger.email,
    passportNumber: passenger.passportNumber,
    dateOfBirth: passenger.dateOfBirth?.toISOString() ?? null,
    notes: passenger.notes,
    portalStatus: passenger.portalStatus,
    portalLink: primaryTripLink,
    companions: passenger.companions.map((c) => ({
      id: c.id,
      name: c.name,
      relationship: c.relationship,
      dateOfBirth: c.dateOfBirth?.toISOString() ?? null,
      notes: getCompanionNotes(c.structuredMetadata),
    })),
    trips: passenger.tripPassengers.map((tp) => ({
      tripPassengerId: tp.id,
      tripId: tp.tripId,
      isLead: tp.isLead,
      title: tp.trip.title,
      status: tp.trip.status,
      destination: tp.trip.destination,
      startDate: tp.trip.startDate.toISOString(),
      endDate: tp.trip.endDate.toISOString(),
      documentCount: tp.trip._count.documents,
      entityOptions: buildEntityOptions(tp.trip),
    })),
    conversations: passenger.conversations.map((c) => ({
      id: c.id,
      phone: c.phone,
      status: c.status,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      lastMessage: c.messages[0]?.body ?? null,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Passageiro"
        title={passenger.name}
        description="Hub centralizado com viagens, documentos, companions e atendimento."
        actions={(
          <>
            <Link
              href={`/dashboard/trips/new?passengerId=${passenger.id}`}
              className="rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
            >
              Criar viagem
            </Link>
            <Link
              href={`/dashboard/passengers/${passenger.id}/edit`}
              className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c8d6c6]"
            >
              Editar cadastro
            </Link>
            <DeleteResourceButton
              endpoint={`/api/admin/passengers/${passenger.id}`}
              redirectTo="/dashboard/passengers?deleted=1"
              dialogTitle="Excluir passageiro"
              dialogDescription="Esse passageiro deixara de aparecer na operacao e a exclusao nao podera ser desfeita pela interface."
              idleLabel="Excluir passageiro"
              pendingLabel="Excluindo passageiro..."
              successMessage="Passageiro excluido com sucesso."
              errorMessage="Nao foi possivel excluir o passageiro."
            />
            {primaryTripLink && (
              <Link
                href={primaryTripLink}
                target="_blank"
                className="rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
              >
                Abrir portal
              </Link>
            )}
          </>
        )}
      />

      {(searchParams.saved === '1' || searchParams.updated === '1') && (
        <div className="rounded-[24px] border border-[#cfe7d6] bg-[#edf9f0] px-5 py-4 text-sm text-[#11623a]">
          {searchParams.saved === '1' ? 'Passageiro criado com sucesso.' : 'Passageiro atualizado com sucesso.'}
        </div>
      )}

      <PassengerHub passenger={hubData} />
    </div>
  );
}
