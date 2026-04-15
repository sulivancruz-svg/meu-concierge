import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { TripForm } from '@/components/trips/trip-form';
import { PageHeader } from '@/components/ui/page-header';

export default function NewTripPage({
  searchParams,
}: {
  searchParams: { passengerId?: string };
}) {
  const passengerId = searchParams.passengerId?.trim() || undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={passengerId ? `/dashboard/passengers/${passengerId}` : '/dashboard/trips'}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5b665d] transition hover:text-[#142018]"
        >
          <ChevronLeft className="h-4 w-4" />
          {passengerId ? 'Voltar para o passageiro' : 'Voltar para viagens'}
        </Link>
      </div>

      <PageHeader
        eyebrow="Nova jornada"
        title="Cadastrar viagem"
        description="Crie a operação base da viagem com código interno, status, passageiros vinculados e foco futuro no WhatsApp."
      />

      <TripForm mode="create" defaultPassengerId={passengerId} />
    </div>
  );
}
