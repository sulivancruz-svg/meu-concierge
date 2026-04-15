import { redirect } from 'next/navigation';
import { RegisterAgencyForm } from '@/components/auth/register-agency-form';
import { PageHeader } from '@/components/ui/page-header';
import { getSession } from '@/lib/auth';

export default async function DashboardNewAgencyPage() {
  const session = await getSession();

  if (!session?.user.isPlatformOwner) {
    redirect('/dashboard/settings');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Expansao SaaS"
        title="Nova agencia"
        description="Cadastro de uma nova conta SaaS com owner inicial e ambiente operacional separado da agencia atual."
      />

      <div className="flex justify-center">
        <RegisterAgencyForm compact mode="invite" />
      </div>
    </div>
  );
}
