import Link from 'next/link';
import { ArrowRight, Database, KeyRound, MessageSquareText, Rocket, ShieldCheck, Store } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSupabaseSetupStatus } from '@/lib/supabase/config';
import { AgencyAccountForm } from '@/components/settings/agency-account-form';
import { AgencyTeamManager } from '@/components/settings/agency-team-manager';
import { PlatformAgenciesManager } from '@/components/settings/platform-agencies-manager';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;
  const isPlatformOwner = session.user.isPlatformOwner;
  const isPlatformContext = isPlatformOwner && session.user.agencyId === session.user.baseAgencyId;

  const agency = await prisma.agency.findFirst({
    where: { id: session.user.agencyId },
  });
  const agencyUsers = await prisma.agencyUser.findMany({
    where: {
      agencyId: session.user.agencyId,
      deletedAt: null,
    },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  const platformAgencies = isPlatformContext
    ? await prisma.agency.findMany({
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          supportEmail: true,
          status: true,
          plan: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              passengers: true,
              trips: true,
            },
          },
        },
      })
    : [];

  const supabase = getSupabaseSetupStatus();
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const hasPublicAppUrl = /^https?:\/\/(?!localhost\b)(?!127\.0\.0\.1\b)(?!0\.0\.0\.0\b)/i.test(appUrl);
  const whatsappReady = Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN);
  const whatsappSigned = Boolean(process.env.WA_APP_SECRET);
  const whatsappPlatformReady = Boolean(whatsappReady && whatsappSigned && hasPublicAppUrl);
  const aerodataboxReady = Boolean(process.env.AERODATABOX_API_KEY);
  const aerodataboxSecret = Boolean(process.env.AERODATABOX_WEBHOOK_SECRET);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Plataforma"
        title="Configuracoes"
        description="Camada de plataforma do Concierge do Passageiro com Postgres no Supabase, auth administrativo, storage isolado e trilha pronta para portal do passageiro."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Agencia" value={agency?.name ?? 'Sem agencia'} detail={agency?.plan ?? 'Plano indefinido'} icon={Store} />
        <StatCard title="Usuario atual" value={session.user.role} detail={session.user.email} icon={ShieldCheck} />
        <StatCard
          title="WhatsApp"
          value={whatsappPlatformReady ? 'Pronto' : whatsappReady ? 'Parcial' : 'Pendente'}
          detail="Webhook e Cloud API"
          icon={MessageSquareText}
          tone={whatsappPlatformReady ? 'accent' : 'warn'}
        />
        <StatCard title="Supabase" value={supabase.configured ? 'Pronto' : 'Preparacao'} detail={supabase.storageBucket} icon={Rocket} tone={supabase.configured ? 'accent' : 'warn'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AgencyAccountForm
          initialAgency={{
            name: agency?.name ?? '',
            slug: agency?.slug ?? '',
            supportEmail: agency?.supportEmail ?? null,
            supportPhone: agency?.supportPhone ?? null,
            supportWhatsApp: agency?.supportWhatsApp ?? null,
            status: agency?.status ?? '-',
            plan: agency?.plan ?? '-',
          }}
        />

        {isPlatformContext ? (
          <SectionCard title="Arquitetura de plataforma" description="Stack operacional atual e trilha de evolucao para auth, banco, storage e realtime.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-[#d9e2d5] bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#1f6b46]" />
                  <p className="font-semibold text-[#142018]">Stack atual</p>
                </div>
                <div className="space-y-2 text-sm text-[#5b665d]">
                  <p>Banco operacional: Supabase Postgres + Prisma</p>
                  <p>Autenticacao administrativa: Supabase Auth</p>
                  <p>Storage de documentos: Supabase Storage</p>
                  <p>Mensageria: WhatsApp Cloud API</p>
                </div>
              </div>
              <div className="rounded-[24px] border border-[#d9e2d5] bg-white p-5">
                <div className="mb-3 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[#1f6b46]" />
                  <p className="font-semibold text-[#142018]">Seguranca e evolucao</p>
                </div>
                <div className="space-y-2 text-sm text-[#5b665d]">
                  <p>RLS para admins e passageiros por isolamento de agencia e jornada</p>
                  <p>Passenger auth desacoplado de WhatsApp com vinculo a auth.users</p>
                  <p>Realtime para atualizacao de status e timeline</p>
                  <p>Edge Functions para automacoes da jornada</p>
                </div>
              </div>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Conta da agencia" description="Dados operacionais e gestao da sua equipe nesta conta.">
            <div className="rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-4 text-sm text-[#38463a]">
              As configuracoes de plataforma, integracoes globais e expansao SaaS ficam disponiveis apenas para a conta principal do sistema.
            </div>
          </SectionCard>
        )}
      </div>

      <AgencyTeamManager
        initialUsers={agencyUsers.map((user) => ({
          ...user,
          role: user.role as 'OWNER' | 'ADMIN' | 'AGENT',
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          createdAt: user.createdAt.toISOString(),
        }))}
        currentUserId={session.user.id}
        currentUserRole={session.user.role as 'OWNER' | 'ADMIN' | 'AGENT'}
      />

      {isPlatformContext && (
        <SectionCard
          title="Expansao SaaS"
          description="Criar uma nova agencia separada da sua operacao atual, com owner inicial e ambiente exclusivo."
          action={(
            <Link
              href="/dashboard/settings/new-agency"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018]"
            >
              Nova agencia
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        >
          <div className="rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-4 text-sm text-[#38463a]">
            Use esse fluxo quando o usuario for um novo cliente do SaaS. Para novos operadores da mesma empresa, continue usando a gestao de equipe acima.
          </div>
        </SectionCard>
      )}

      {isPlatformContext && (
        <PlatformAgenciesManager
          currentAgencyId={session.user.agencyId}
          agencies={platformAgencies.map((agency) => ({
            id: agency.id,
            name: agency.name,
            slug: agency.slug,
            supportEmail: agency.supportEmail,
            status: agency.status,
            plan: agency.plan,
            createdAt: agency.createdAt.toISOString(),
            usersCount: agency._count.users,
            passengersCount: agency._count.passengers,
            tripsCount: agency._count.trips,
          }))}
        />
      )}

      {isPlatformContext && (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard title="WhatsApp e IA" description="Camada backend-first para inbound, outbound, viagem ativa e envio futuro de documentos.">
              <div className="space-y-3">
                <div className="rounded-2xl bg-[#f6f7f2] p-4 text-sm text-[#38463a]">
                  <p className="font-semibold text-[#142018]">Webhook</p>
                  <p className="mt-2">{appUrl}/api/webhooks/whatsapp</p>
                </div>
                {!hasPublicAppUrl && (
                  <div className="rounded-2xl border border-[#f1d7b8] bg-[#fff7eb] p-4 text-sm text-[#7a4f00]">
                    O APP_URL atual ainda e local. Para validar o webhook na Meta voce precisa expor uma URL publica HTTPS.
                  </div>
                )}
                <div className="rounded-2xl bg-[#f6f7f2] p-4 text-sm text-[#38463a]">
                  <p className="font-semibold text-[#142018]">Segredos operacionais</p>
                  <p className="mt-2">Verify token e app secret ficam ocultos na interface e usados apenas no backend.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={process.env.WA_PHONE_NUMBER_ID ? 'success' : 'warning'}>
                    {process.env.WA_PHONE_NUMBER_ID ? 'Phone number id configurado' : 'Phone number id pendente'}
                  </StatusBadge>
                  <StatusBadge tone={process.env.WA_ACCESS_TOKEN ? 'success' : 'warning'}>
                    {process.env.WA_ACCESS_TOKEN ? 'Access token configurado' : 'Access token pendente'}
                  </StatusBadge>
                  <StatusBadge tone={process.env.WA_VERIFY_TOKEN ? 'success' : 'warning'}>
                    {process.env.WA_VERIFY_TOKEN ? 'Verify token presente' : 'Verify token pendente'}
                  </StatusBadge>
                  <StatusBadge tone={whatsappSigned ? 'success' : 'warning'}>
                    {whatsappSigned ? 'Assinatura POST habilitada' : 'Assinatura POST pendente'}
                  </StatusBadge>
                  <StatusBadge tone={hasPublicAppUrl ? 'success' : 'warning'}>
                    {hasPublicAppUrl ? 'APP_URL publico' : 'APP_URL local'}
                  </StatusBadge>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Preparacao Supabase" description="Contrato de ambiente para auth, storage, banco e servicos administrativos.">
              <div className="space-y-3">
                {supabase.checks.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3">
                    <code className="text-sm text-[#38463a]">{item.key}</code>
                    <StatusBadge tone={item.configured ? 'success' : 'warning'}>
                      {item.configured ? 'Configurado' : 'Pendente'}
                    </StatusBadge>
                  </div>
                ))}
                <div className="rounded-2xl bg-[#f6f7f2] p-4 text-sm text-[#38463a]">
                  <p className="font-semibold text-[#142018]">Bucket previsto</p>
                  <p className="mt-2">{supabase.storageBucket}</p>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <SectionCard title="Monitoramento de voos" description="AeroDataBox operando apenas no backend, com persistencia de status e historico local.">
              <div className="space-y-3">
                <div className="rounded-2xl bg-[#f6f7f2] p-4 text-sm text-[#38463a]">
                  <p className="font-semibold text-[#142018]">Webhook de voo</p>
                  <p className="mt-2">{appUrl}/api/webhooks/aerodatabox</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone={aerodataboxReady ? 'success' : 'warning'}>
                    {aerodataboxReady ? 'API key configurada' : 'API key pendente'}
                  </StatusBadge>
                  <StatusBadge tone={aerodataboxSecret ? 'success' : 'warning'}>
                    {aerodataboxSecret ? 'Segredo do webhook configurado' : 'Segredo do webhook pendente'}
                  </StatusBadge>
                </div>
                <div className="rounded-2xl bg-[#f6f7f2] p-4 text-sm text-[#38463a]">
                  <p className="font-semibold text-[#142018]">Fluxo esperado</p>
                  <p className="mt-2">Cadastrar voo, registrar assinatura, receber evento backend, persistir status atual, gravar historico e refletir isso nas telas e na IA.</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Prontidao SaaS" description="Pontos de arquitetura que ja estao isolados para futura multiagencia e integracoes reais.">
              <div className="space-y-3 text-sm text-[#38463a]">
                <div className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-4">
                  Inbound e outbound do WhatsApp estao no backend e persistem em `conversations` e `messages`.
                </div>
                <div className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-4">
                  Status de voo vem de webhook backend e o frontend le apenas o banco e o historico local.
                </div>
                <div className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-4">
                  Documentos podem ser enviados por signed URL, sem expor bucket nem chave no frontend.
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
