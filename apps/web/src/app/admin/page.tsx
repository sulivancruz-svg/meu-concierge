import { requirePlatformOwner } from '@/lib/auth';
import { db } from '@/lib/db';
import { Building2, Users, TrendingUp, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  await requirePlatformOwner();

  const [totalAgencies, activeAgencies, suspendedAgencies, recentAgencies] = await Promise.all([
    db.agency.count({ where: { status: { not: 'DELETED' } } }),
    db.agency.count({ where: { status: 'ACTIVE' } }),
    db.agency.count({ where: { status: 'SUSPENDED' } }),
    db.agency.findMany({
      where: { status: { not: 'DELETED' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        createdAt: true,
        _count: { select: { users: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
    }),
  ]);

  const stats = [
    { label: 'Total de agencias', value: totalAgencies, icon: Building2, color: 'text-[#f0b35b]', bg: 'bg-[#f0b35b]/10' },
    { label: 'Agencias ativas', value: activeAgencies, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Suspensas', value: suspendedAgencies, icon: ShieldCheck, color: 'text-red-400', bg: 'bg-red-400/10' },
    { label: 'Total de usuarios', value: 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ];

  const planLabel: Record<string, string> = {
    STARTER: 'Starter',
    PRO: 'Pro',
    ENTERPRISE: 'Enterprise',
  };

  const planColor: Record<string, string> = {
    STARTER: 'text-white/40 bg-white/5',
    PRO: 'text-[#f0b35b] bg-[#f0b35b]/10',
    ENTERPRISE: 'text-emerald-400 bg-emerald-400/10',
  };

  const statusColor: Record<string, string> = {
    ACTIVE: 'text-emerald-400 bg-emerald-400/10',
    SUSPENDED: 'text-red-400 bg-red-400/10',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-white/40">Visao geral da plataforma.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/4 p-5">
              <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-white/40">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/4">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-sm font-semibold text-white">Agencias recentes</h2>
          <Link href="/admin/agencies" className="text-xs text-[#f0b35b]/80 hover:text-[#f0b35b] transition">
            Ver todas
          </Link>
        </div>
        <div className="divide-y divide-white/5">
          {recentAgencies.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-white/30">Nenhuma agencia cadastrada ainda.</p>
          )}
          {recentAgencies.map((agency) => (
            <div key={agency.id} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-xs font-bold text-white/60">
                  {agency.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{agency.name}</p>
                  <p className="text-xs text-white/30">{agency.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${planColor[agency.plan]}`}>
                  {planLabel[agency.plan]}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[agency.status] ?? 'text-white/40 bg-white/5'}`}>
                  {agency.status === 'ACTIVE' ? 'Ativa' : 'Suspensa'}
                </span>
                <span className="text-xs text-white/30">{agency._count.users} usuario{agency._count.users !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
