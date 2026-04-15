import { differenceInCalendarDays, isAfter } from 'date-fns';
import type { SerializedTripDocument } from '@/modules/documents/document-presentation';
import type { TripTimelineGroup, TripTimelineItem } from '@/modules/trips/timeline';
import { groupTripTimeline } from '@/modules/trips/timeline';
import type { getTripPortalSnapshot } from './data';

type Snapshot = NonNullable<Awaited<ReturnType<typeof getTripPortalSnapshot>>>;

function sortByDate<T extends { date: Date }>(items: T[]) {
  return [...items].sort((left, right) => left.date.getTime() - right.date.getTime());
}

function uniqueStrings(items: Array<string | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function buildUpcomingItems(timeline: TripTimelineItem[]) {
  const now = new Date();
  const upcoming = timeline.filter((item) => isAfter(item.date, now));
  const source = upcoming.length > 0 ? upcoming : timeline.slice(-3);
  return sortByDate(source).slice(0, 4);
}

function buildImportantDocuments(documents: SerializedTripDocument[]) {
  const score = (document: SerializedTripDocument) => {
    if (document.isEssential) return 0;
    if (['boarding_pass', 'hotel_voucher', 'transport_voucher', 'tour_voucher', 'train_ticket', 'insurance', 'itinerary'].includes(document.category)) {
      return 1;
    }
    return 2;
  };

  return [...documents]
    .sort((left, right) => score(left) - score(right))
    .slice(0, 8);
}

function buildImportantNotes(snapshot: Snapshot, upcomingItems: TripTimelineItem[]) {
  const notes: Array<{ title: string; body: string }> = [];

  for (const alert of snapshot.trip.alerts.slice(0, 3)) {
    notes.push({
      title: alert.title,
      body: alert.body,
    });
  }

  for (const item of upcomingItems.slice(0, 3)) {
    if (!item.summary) {
      continue;
    }

    notes.push({
      title: item.title,
      body: item.summary,
    });
  }

  if (snapshot.trip.insurancePolicies[0]?.emergencyPhone) {
    notes.push({
      title: 'Contato do seguro',
      body: `Em caso de necessidade, use ${snapshot.trip.insurancePolicies[0].emergencyPhone}.`,
    });
  }

  return notes.slice(0, 5);
}

function buildUsefulContacts(snapshot: Snapshot) {
  const hotelPhones = uniqueStrings(snapshot.trip.hotelBookings.map((hotel) => hotel.phone));
  const insurancePhones = uniqueStrings(snapshot.trip.insurancePolicies.map((insurance) => insurance.emergencyPhone));

  return [
    {
      label: 'Agencia',
      primary: snapshot.trip.agency.name,
      secondary: snapshot.trip.agency.supportWhatsApp || snapshot.trip.agency.supportPhone || snapshot.trip.agency.supportEmail || 'Contato indisponivel',
    },
    ...hotelPhones.slice(0, 2).map((phone, index) => ({
      label: `Hotel ${index + 1}`,
      primary: phone,
      secondary: 'Contato da hospedagem',
    })),
    ...insurancePhones.slice(0, 2).map((phone, index) => ({
      label: `Seguro ${index + 1}`,
      primary: phone,
      secondary: 'Assistencia emergencial',
    })),
  ];
}

function buildTripStatusLabel(status: string, startDate: Date, endDate: Date) {
  const now = new Date();

  if (status === 'IN_PROGRESS') {
    return 'Em andamento';
  }

  if (status === 'COMPLETED') {
    return 'Concluida';
  }

  if (differenceInCalendarDays(startDate, now) > 0) {
    return 'Preparando embarque';
  }

  if (differenceInCalendarDays(endDate, now) < 0) {
    return 'Viagem finalizada';
  }

  return 'Planejada';
}

export function buildPassengerPortalViewModel(input: {
  snapshot: Snapshot;
  timeline: TripTimelineItem[];
}) {
  const { snapshot, timeline } = input;
  const passengerName = snapshot.passenger?.passenger?.name ?? snapshot.passenger?.name ?? 'Passageiro';
  const groupedTimeline = groupTripTimeline(timeline);
  const upcomingItems = buildUpcomingItems(timeline);
  const importantDocuments = buildImportantDocuments(snapshot.documents);
  const importantNotes = buildImportantNotes(snapshot, upcomingItems);
  const usefulContacts = buildUsefulContacts(snapshot);

  return {
    passengerName,
    destination: snapshot.trip.destination ?? 'Destino em definicao',
    tripTitle: snapshot.trip.title,
    tripStatusLabel: buildTripStatusLabel(snapshot.trip.status, snapshot.trip.startDate, snapshot.trip.endDate),
    groupedTimeline,
    upcomingItems,
    importantDocuments,
    importantNotes,
    usefulContacts,
    sections: {
      flights: snapshot.trip.flightSegments,
      hotels: snapshot.trip.hotelBookings,
      transports: snapshot.trip.transportBookings,
      tours: snapshot.trip.tourBookings,
      trains: snapshot.trip.trainBookings,
      insurances: snapshot.trip.insurancePolicies,
    },
  };
}
