import Link from 'next/link';
import { Bell, Files, MessageSquareText, PlaneTakeoff, UsersRound } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertsFeed } from '@/components/alerts/alerts-feed';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { listAgencyAlerts, syncOperationalAlertsForAgency } from '@/modules/alerts/service';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const agencyId = session.user.agencyId;
  const now = new Date();
  try { await syncOperationalAlertsForAgency(agencyId); } catch { /* non-critical */ }

  const [
    tripsUpcoming,
    tripsInProgress,
    totalDocuments,
    unresolvedAlerts,
    activePassengers,
    spotlightTrips,
    recentConversations,
    recentDocuments,
    recentAlerts,
    inboundWaiting,
    documentlessTrips,
  ] = await Promise.all([
    prisma.trip.count({
      where: {
        agencyId,
        status: 'READY',
        startDate: { gte: now },
      },
    }),
    prisma.trip.count({ where: { agencyId, status: 'IN_PROGRESS' } }),
    prisma.document.count({ where: { agencyId, deletedAt: null } }),
    prisma.alert.count({ where: { agencyId, resolvedAt: null } }),
    prisma.tripPassenger.count({
      where: {
        passengerId: { not: null },
        trip: {
          agencyId,
          status: { in: ['READY', 'IN_PROGRESS'] },
          endDate: { gte: now },
        },
      },
    }),
    prisma.trip.findMany({
      where: {
        agencyId,
        status: { in: ['READY', 'IN_PROGRESS'] },
        endDate: { gte: now },
      },
      orderBy: [
        { status: 'desc' },
        { startDate: 'asc' },
      ],
      take: 6,
      include: {
        passengers: {
          take: 3,
          include: { passenger: { select: { name: true } } },
        },
        _count: { select: { documents: true, alerts: true } },
      },
    }),
    prisma.conversation.findMany({
      where: { agencyId },
      orderBy: { lastMessageAt: 'desc' },
      take: 6,
      include: {
        passenger: { select: { name: true } },
        trip: { select: { title: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.document.findMany({
      where: { agencyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        trip: { select: { id: true, title: true } },
        passenger: { select: { name: true } },
      },
    }),
    listAgencyAlerts(agencyId, { take: 6 }),
    prisma.conversation.count({
      where: {
        agencyId,
        status: 'OPEN',
        messages: {
          some: {
            direction: 'INBOUND',
          },
        },
      },
    }),
    prisma.trip.count({
      where: {
        agencyId,
        status: { in: ['READY', 'IN_PROGRESS'] },
        documents: { none: { deletedAt: null } },
      },
    }),
  ]);

  const pendingOperationalItems = [
    { label: 'Alertas sem resolucao', value: unresolvedAlerts, tone: unresolvedAlerts > 0 ? 'danger' : 'neutral' },
    { label: 'Conversas esperando retorno', value: inboundWaiting, tone: inboundWaiting > 0 ? 'warning' : 'neutral' },
    { label: 'Viagens sem documentos', value: documentlessTrips, tone: documentlessTrips > 0 ? 'warning' : 'neutral' },
    { label: 'Viagens proximas', value: tripsUpcoming, tone: tripsUpcoming > 0 ? 'info' : 'neutral' },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cockpit"
        title="Operacao da agencia"
        description="Cockpit operacional com jornadas proximas, passageiros ativos, atendimento recente e pendencias reais da agencia."
        actions={(
          <>
            <Link
              href="/dashboard/passengers/new"
              className="rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
            >
              Novo passageiro
            </Link>
            <Link
              href="/dashboard/trips/new"
              className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c3d1c1]"
            >
              Nova jornada
            </Link>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Jornadas proximas" value={tripsUpcoming} detail="Jornadas prontas para embarcar" icon={PlaneTakeoff} tone={tripsUpcoming > 0 ? 'warn' : 'default'} />
        <StatCard title="Jornadas em andamento" value={tripsInProgress} detail="Operacao em curso" icon={PlaneTakeoff} tone="accent" />
        <StatCard title="Passageiros ativos" value={activePassengers} detail="Com viagem pronta ou em curso" icon={UsersRound} />
        <StatCard title="Alertas recentes" value={unresolvedAlerts} detail="Eventos sem resolucao" icon={Bell} tone={unresolvedAlerts > 0 ? 'danger' : 'default'} />
        <StatCard title="Docs na base" value={totalDocuments} detail="Biblioteca documental da agencia" icon={Files} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Jornadas em foco"
          description="Proximas partidas e jornadas em andamento que pedem leitura operacional."
          action={<Link href="/dashboard/trips" className="text-sm font-semibold text-[#1f6b46]">Ver visao global</Link>}
        >
          <div className="space-y-3">
            {spotlightTrips.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] p-8 text-center text-sm text-[#5b665d]">
                Nenhuma viagem pronta ou em andamento no momento.
              </div>
            ) : spotlightTrips.map((trip) => (
              <Link
                key={trip.id}
                href={`/dashboard/trips/${trip.id}`}
                className="block rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4 transition hover:border-[#bfd3c3] hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-[#142018]">{trip.title}</p>
                      <StatusBadge tone={trip.status === 'IN_PROGRESS' ? 'success' : 'info'}>
                        {trip.status === 'IN_PROGRESS' ? 'Em curso' : 'Proxima'}
                      </StatusBadge>
                    </div>
                    <p className="text-sm text-[#5b665d]">
                      {trip.destination ?? 'Destino nao informado'} · {format(trip.startDate, "d 'de' MMM", { locale: ptBR })} ate {format(trip.endDate, "d 'de' MMM", { locale: ptBR })}
                    </p>
                    <p className="text-sm text-[#5b665d]">
                      {trip.passengers.map((passenger) => passenger.passenger?.name ?? passenger.name).join(', ')}
                    </p>
                  </div>
                  <div className="space-y-1 text-right text-xs text-[#6e786f]">
                    <p>{trip._count.documents} documentos</p>
                    <p>{trip._count.alerts} alertas</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Pendencias operacionais"
          description="Leitura rapida do que depende de acao da agencia agora."
          action={<Link href="/dashboard/alerts" className="text-sm font-semibold text-[#1f6b46]">Abrir alertas</Link>}
        >
          <div className="space-y-3">
            {pendingOperationalItems.map((item) => (
              <div key={item.label} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#142018]">{item.label}</p>
                    <p className="mt-1 text-sm text-[#5b665d]">Indicador consolidado do cockpit operacional.</p>
                  </div>
                  <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Alertas recentes"
          description="Fila priorizada de eventos importantes da operacao."
          action={<Link href="/dashboard/alerts" className="text-sm font-semibold text-[#1f6b46]">Ver todos</Link>}
        >
          <AlertsFeed items={recentAlerts} emptyMessage="Nenhum alerta recente." />
        </SectionCard>

        <SectionCard
          title="Conversas recentes"
          description="Historico mais recente dos contatos de passageiros e operacao."
          action={<Link href="/dashboard/conversations" className="text-sm font-semibold text-[#1f6b46]">Abrir inbox</Link>}
        >
          <div className="space-y-3">
            {recentConversations.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] p-8 text-center text-sm text-[#5b665d]">
                Nenhuma conversa registrada ainda.
              </div>
            ) : recentConversations.map((conversation) => (
              <div key={conversation.id} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#142018]">{conversation.passenger?.name ?? conversation.phone}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#7b857b]">
                      {conversation.trip?.title ?? 'Sem viagem vinculada'}
                    </p>
                    <p className="mt-2 text-sm text-[#5b665d]">{conversation.messages[0]?.body ?? 'Sem historico recente'}</p>
                  </div>
                  <StatusBadge tone={conversation.status === 'OPEN' ? 'warning' : 'neutral'}>{conversation.status}</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard
          title="Documentos recentes"
          description="Ultimos arquivos adicionados ao hub operacional."
          action={<Link href="/dashboard/documents" className="text-sm font-semibold text-[#1f6b46]">Abrir documentos</Link>}
        >
          <div className="space-y-3">
            {recentDocuments.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] p-8 text-center text-sm text-[#5b665d]">
                Nenhum documento recente.
              </div>
            ) : recentDocuments.map((document) => (
              <div key={document.id} className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#142018]">{document.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#7b857b]">
                      {document.trip?.title ?? 'Sem viagem vinculada'}
                    </p>
                    <p className="mt-2 text-sm text-[#5b665d]">{document.passenger?.name ?? 'Documento geral da viagem'}</p>
                  </div>
                  <StatusBadge tone={document.isEssential ? 'success' : 'neutral'}>
                    {document.isEssential ? 'Essencial' : 'Padrao'}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Atendimento em curso"
          description="Visao resumida das conversas abertas e do volume recente da operacao."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Conversas abertas</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#142018]">{recentConversations.length}</p>
              <p className="mt-2 text-sm text-[#5b665d]">Threads recentes carregadas no cockpit.</p>
            </div>
            <div className="rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Esperando resposta</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#142018]">{inboundWaiting}</p>
              <p className="mt-2 text-sm text-[#5b665d]">Conversas cujo ultimo movimento veio do passageiro.</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
