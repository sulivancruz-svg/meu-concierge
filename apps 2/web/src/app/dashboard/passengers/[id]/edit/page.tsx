import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PassengerForm } from '@/components/passengers/passenger-form';
import { PageHeader } from '@/components/ui/page-header';

function getCompanionNotes(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '';
  }

  const notes = (metadata as Record<string, unknown>).notes;
  return typeof notes === 'string' ? notes : '';
}

function toInputDate(value: Date | null) {
  if (!value) {
    return '';
  }

  return value.toISOString().slice(0, 10);
}

export default async function EditPassengerPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const passenger = await prisma.passenger.findFirst({
    where: {
      id: params.id,
      agencyId: session.user.agencyId,
      deletedAt: null,
    },
    include: {
      companions: {
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!passenger) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Passageiros"
        title={`Editar ${passenger.name}`}
        description="Atualize os dados principais do passageiro e mantenha os acompanhantes alinhados com a jornada."
      />

      <PassengerForm
        mode="edit"
        passengerId={passenger.id}
        initialValues={{
          name: passenger.name,
          phone: passenger.phone ?? '',
          email: passenger.email ?? '',
          dateOfBirth: toInputDate(passenger.dateOfBirth),
          passportNumber: passenger.passportNumber ?? '',
          notes: passenger.notes ?? '',
          companions: passenger.companions.map((companion) => ({
            name: companion.name,
            relationship: companion.relationship ?? '',
            dateOfBirth: toInputDate(companion.dateOfBirth),
            notes: getCompanionNotes(companion.structuredMetadata),
          })),
        }}
      />
    </div>
  );
}
