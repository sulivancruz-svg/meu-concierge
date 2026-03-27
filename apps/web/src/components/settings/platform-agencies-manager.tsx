'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';

type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  supportEmail: string | null;
  status: string;
  plan: string;
  createdAt: string;
  usersCount: number;
  passengersCount: number;
  tripsCount: number;
};

type Props = {
  agencies: AgencyRow[];
  currentAgencyId: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(new Date(value));
}

export function PlatformAgenciesManager({ agencies, currentAgencyId }: Props) {
  const router = useRouter();
  const [runningAgencyId, setRunningAgencyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleDelete(agency: AgencyRow) {
    const confirmed = window.confirm(`Excluir a agencia ${agency.name}? Isso remove usuarios, passageiros, viagens e documentos dessa conta.`);
    if (!confirmed) {
      return;
    }

    setRunningAgencyId(agency.id);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/admin/platform/agencies/${agency.id}`, {
        method: 'DELETE',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(typeof payload?.error === 'string' ? payload.error : 'Nao foi possivel excluir a agencia.');
        return;
      }

      setSuccess('Agencia excluida com sucesso.');
      router.refresh();
    } catch {
      setError('Erro de comunicacao ao excluir a agencia.');
    } finally {
      setRunningAgencyId(null);
    }
  }

  return (
    <SectionCard title="Agencias cadastradas" description="Visao de plataforma do SaaS, com listagem das contas criadas e opcao de exclusao.">
      <div className="space-y-4">
        {(error || success) && (
          <div className={error
            ? 'rounded-2xl border border-[#f1c4bc] bg-[#fff3f0] px-4 py-3 text-sm text-[#9b3528]'
            : 'rounded-2xl border border-[#cfe1cc] bg-[#ecf6ea] px-4 py-3 text-sm text-[#163020]'}
          >
            {error || success}
          </div>
        )}

        <div className="space-y-3">
          {agencies.map((agency) => {
            const isCurrent = agency.id === currentAgencyId;

            return (
              <div key={agency.id} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#142018]">{agency.name}</p>
                      <StatusBadge tone={isCurrent ? 'success' : 'neutral'}>
                        {isCurrent ? 'Agencia atual' : agency.plan}
                      </StatusBadge>
                      <StatusBadge tone={agency.status === 'ACTIVE' ? 'success' : 'warning'}>
                        {agency.status}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-[#5b665d]">/{agency.slug}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-[#7b857b]">
                      <span>Criada em {formatDate(agency.createdAt)}</span>
                      <span>{agency.usersCount} usuarios</span>
                      <span>{agency.passengersCount} passageiros</span>
                      <span>{agency.tripsCount} viagens</span>
                      {agency.supportEmail && <span>{agency.supportEmail}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/api/admin/platform/agencies/${agency.id}/switch`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#142018]"
                    >
                      <Building2 className="h-4 w-4" />
                      Abrir
                    </Link>
                    <button
                      type="button"
                      disabled={isCurrent || runningAgencyId === agency.id}
                      onClick={() => handleDelete(agency)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#f1c4bc] bg-white px-3 py-2 text-sm font-semibold text-[#9b3528] disabled:opacity-60"
                    >
                      {runningAgencyId === agency.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
