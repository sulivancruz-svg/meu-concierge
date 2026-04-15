import { PassengerForm } from '@/components/passengers/passenger-form';
import { PageHeader } from '@/components/ui/page-header';

export default function NewPassengerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Passageiros"
        title="Novo passageiro"
        description="Cadastre um passageiro com dados principais e acompanhantes vinculados, sem transformar a operacao em um formulario frio."
      />

      <PassengerForm mode="create" />
    </div>
  );
}
