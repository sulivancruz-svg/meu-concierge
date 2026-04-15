import { prisma } from '@/lib/db';
import { serializeTripDocuments } from '@/modules/documents/document-presentation';
import { buildJourneyTimeline, groupTripTimeline } from '@/modules/trips/timeline';
import { readOperationMetadata } from '@/modules/trips/operations';

function matchesPassengerScope(
  value: unknown,
  passengerId: string,
) {
  if (!value) {
    return true;
  }

  const meta = readOperationMetadata<Record<string, unknown>>(value as never);
  return typeof meta.passengerId !== 'string' || meta.passengerId === passengerId;
}

export async function getTripPortalSnapshot(tripId: string, passengerId?: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      agency: {
        select: {
          id: true,
          name: true,
          supportEmail: true,
          supportPhone: true,
          supportWhatsApp: true,
        },
      },
      passengers: {
        include: {
          passenger: true,
        },
      },
      flightSegments: { orderBy: { departureAt: 'asc' } },
      hotelBookings: { orderBy: { checkIn: 'asc' } },
      transportBookings: { orderBy: { scheduledAt: 'asc' } },
      tourBookings: { orderBy: { scheduledAt: 'asc' } },
      trainBookings: { orderBy: { departureAt: 'asc' } },
      insurancePolicies: true,
      documents: {
        where: {
          deletedAt: null,
          ...(passengerId ? {
            OR: [
              { passengerId: null },
              { passengerId },
            ],
          } : {}),
        },
        orderBy: [{ isEssential: 'desc' }, { createdAt: 'desc' }],
      },
      alerts: {
        where: { resolvedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      notes: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!trip) {
    return null;
  }

  const passenger = passengerId
    ? trip.passengers.find((item) => item.passengerId === passengerId || item.passenger?.id === passengerId)
    : trip.passengers[0];
  const resolvedPassengerId = passenger?.passengerId ?? passenger?.passenger?.id;

  if (!resolvedPassengerId) {
    return null;
  }

  const documents = (await serializeTripDocuments(trip.documents)).filter((document) => (
    !document.passengerId || document.passengerId === resolvedPassengerId
  ));

  return {
    trip: {
      ...trip,
      passengers: trip.passengers.filter((item) => (
        item.passengerId === resolvedPassengerId || item.passenger?.id === resolvedPassengerId
      )),
      flightSegments: trip.flightSegments.filter((item) => matchesPassengerScope(item.structuredMetadata, resolvedPassengerId)),
      hotelBookings: trip.hotelBookings.filter((item) => matchesPassengerScope(item.structuredMetadata, resolvedPassengerId)),
      transportBookings: trip.transportBookings.filter((item) => matchesPassengerScope(item.structuredMetadata, resolvedPassengerId)),
      tourBookings: trip.tourBookings.filter((item) => matchesPassengerScope(item.structuredMetadata, resolvedPassengerId)),
      trainBookings: trip.trainBookings.filter((item) => matchesPassengerScope(item.structuredMetadata, resolvedPassengerId)),
      insurancePolicies: trip.insurancePolicies.filter((item) => matchesPassengerScope(item.structuredMetadata, resolvedPassengerId)),
    },
    passenger,
    passengerId: resolvedPassengerId,
    documents,
  };
}

export function buildPortalTimeline(snapshot: NonNullable<Awaited<ReturnType<typeof getTripPortalSnapshot>>>) {
  return groupTripTimeline(buildJourneyTimeline(snapshot, { viewer: 'passenger' }));
}
