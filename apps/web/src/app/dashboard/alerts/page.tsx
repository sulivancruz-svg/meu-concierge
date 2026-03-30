import { AlertTriangle, Siren, TimerReset, Waves } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertsFeed } from '@/components/alerts/alerts-feed';
import { DatabaseUnavailableNotice } from '@/components/ui/database-unavailable-notice';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { isPrismaConnectionError } from '@/lib/prisma-error';
import { listAgencyAlerts, syncOperationalAlertsForAgency } from '@/modules/alerts/service';

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) return null;

  const agencyId = session.user.agencyId;
  try {
    await syncOperationalAlertsForAgency(agencyId);
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      throw error;
    }
  }

  let alerts;
  let critical;
  let warning;
  let unresolved;
  let totalRecent;
  try {
    [alerts, critical, warning, unresolved, totalRecent] = await Promise.all([
      listAgencyAlerts(agencyId, { includeResolved: true, take: 30 }),
      prisma.alert.count({ where: { agencyId, severity: 'CRITICAL', resolvedAt: null } }),
      prisma.alert.count({ where: { agencyId, severity: 'WARNING', resolvedAt: null } }),
      prisma.alert.count({ where: { agencyId, resolvedAt: null } }),
      prisma.alert.count({ where: { agencyId } }),
    ]);
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      throw error;
    }

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Monitoramento"
          title="Alertas"
          description="Fila operacional de eventos relevantes para a agencia, com pendencias, contexto de viagem e resolucao direta."
        />
        <DatabaseUnavailableNotice context="A fila de alertas nao foi carregada porque a conexao com o banco falhou." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monitoramento"
        title="Alertas"
        description="Fila operacional de eventos relevantes para a agencia, com pendencias, contexto de viagem e resolucao direta."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Pendentes" value={unresolved} detail="Sem resolucao registrada" icon={TimerReset} tone={unresolved > 0 ? 'warn' : 'default'} />
        <StatCard title="Criticos" value={critical} detail="Exigem acao imediata" icon={Siren} tone={critical > 0 ? 'danger' : 'default'} />
        <StatCard title="Avisos" value={warning} detail="Dependem de acompanhamento" icon={AlertTriangle} tone={warning > 0 ? 'warn' : 'default'} />
        <StatCard title="Total recente" value={totalRecent} detail="Historico consolidado da agencia" icon={Waves} />
      </div>

      <SectionCard title="Fila de eventos" description="Alertas de voo, viagens proximas, pendencias documentais, acoes necessarias e observacoes importantes.">
        <AlertsFeed items={alerts} emptyMessage="Nenhum alerta registrado." resolveEnabled />
      </SectionCard>
    </div>
  );
}
