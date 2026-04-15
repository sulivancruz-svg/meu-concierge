import { requirePlatformOwner } from '@/lib/auth';
import { db } from '@/lib/db';
import { Building2, Plus, Users } from 'lucide-react';
import Link from 'next/link';

export default async function AdminAgenciesPage() {
  await requirePlatformOwner();

  const agencies = await db.agency.findMany({
    where: { status: { not: 'DELETED' } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          users: { where: { status: 'ACTIVE', deletedAt: null } },
        },
      },
    },
  });

  const planLabel: Record<string, string> = {
    STARTER: 'Starter',
    PRO: 'Pro',
    ENTERPRISE: 'Enterprise',
  };

  const planColor: Record<string, string> = {
    STARTER: 'text-white/50 bg-white/6 border-white/10',
    PRO: 'text-[#f0b35b] bg-[#f0b35b]/10 border-[#f0b35b]/20',
    ENTERPRISE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  };

  const statusColor: Record<string, string> = {
    ACTIVE: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    SUSPENDED: 'text-red-400 bg-red-400/10 border-red-400/20',
  };

  const statusLabel: Record<string, string> = {
    ACTIVE: 'Ativa',
    SUSPENDED: 'Suspensa',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Agencias</h1>
          <p className="mt-1 text-sm text-white/40">
            {agencies.length} agencia{agencies.length !== 1 ? 's' : ''} cadastrada{agencies.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin/agencies/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#f0b35b] px-4 py-2.5 text-sm font-semibold text-[#0f1a14] transition hover:bg-[#e8a84a]"
        >
          <Plus className="h-4 w-4" />
          Nova agencia
        </Link>
      </div>

      {agencies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-white/4 py-16">
          <Building2 className="mb-4 h-10 w-10 text-white/20" />
          <p className="text-sm font-medium text-white/40">Nenhuma agencia cadastrada</p>
          <p className="mt-1 text-xs text-white/25">Crie a primeira agencia para comecar.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/30">Agencia</th>
                <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/30">Plano</th>
                <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/30">Status</th>
                <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/30">Usuarios</th>
                <th className="px-6 py-3.5 text-left text-xs font-medium uppercase tracking-wider text-white/30">Criada em</th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {agencies.map((agency) => (
                <tr key={agency.id} className="transition hover:bg-white/3">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-xs font-bold text-white/60">
                        {agency.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{agency.name}</p>
                        <p className="text-xs text-white/30">{agency.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${planColor[agency.plan]}`}>
                      {planLabel[agency.plan]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor[agency.status] ?? 'text-white/40 bg-white/5 border-white/10'}`}>
                      {statusLabel[agency.status] ?? agency.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-white/50">
                      <Users className="h-3.5 w-3.5" />
                      {agency._count.users}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/30">
                    {new Date(agency.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/admin/agencies/${agency.id}`}
                      className="text-xs text-white/40 transition hover:text-white/80"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
