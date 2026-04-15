import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TripForm } from '@/components/trips/trip-form';
import { PageHeader } from '@/components/ui/page-header';
import { isTripActiveForWhatsApp, readTripOperationalMeta } from '@/modules/trips/trip-meta';

export default async function EditTripPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const trip = await prisma.trip.findFirst({
    where: {
      id: params.id,
      agencyId: session.user.agencyId,
    },
    include: {
      passengers: {
        select: {
          passengerId: true,
        },
      },
    },
  });

  if (!trip) {
    notFound();
  }

  const operational = readTripOperationalMeta(trip.structuredMetadata);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/trips/${trip.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b665d] transition hover:text-[#142018]">
          <ChevronLeft className="h-4 w-4" />
          Voltar para a viagem
        </Link>
      </div>

      <PageHeader
        eyebrow="Edicao"
        title="Editar viagem"
        description="Atualize posicionamento operacional, passageiros vinculados e prioridade futura para WhatsApp."
      />

      <TripForm
        mode="edit"
        tripId={trip.id}
        initialValues={{
          title: trip.title,
          internalCode: operational.internalCode ?? '',
          destination: trip.destination ?? '',
          startDate: trip.startDate.toISOString().slice(0, 10),
          endDate: trip.endDate.toISOString().slice(0, 10),
          status: trip.status,
          notes: trip.internalNotes ?? '',
          activeForWhatsApp: isTripActiveForWhatsApp(trip),
          passengerIds: trip.passengers.map((passenger) => passenger.passengerId).filter((value): value is string => Boolean(value)),
        }}
      />
    </div>
  );
}
