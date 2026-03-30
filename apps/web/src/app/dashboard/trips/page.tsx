import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarRange, MessageSquareShare, PlaneTakeoff, Search, UsersRound } from 'lucide-react';
import { Prisma, TripStatus } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DeleteResourceButton } from '@/components/ui/delete-resource-button';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { getTripStatusLabel, getTripStatusTone, isTripActiveForWhatsApp, readTripOperationalMeta, TRIP_STATUS_OPTIONS } from '@/modules/trips/trip-meta';

function parseSearchDate(search: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(search.trim())) {
    return null;
  }

  const start = new Date(`${search.trim()}T00:00:00.000Z`);
  const end = new Date(`${search.trim()}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; deleted?: string };
}) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const q = searchParams.q ?? '';
  const status = searchParams.status ?? '';
  const searchDate = parseSearchDate(q);

  const orFilters: Prisma.TripWhereInput[] = [];
  if (q) {
    orFilters.push(
      { title: { contains: q, mode: 'insensitive' } },
      { destination: { contains: q, mode: 'insensitive' } },
      {
        structuredMetadata: {
          path: ['internalCode'],
          string_contains: q,
        },
      },
    );
  }

  if (searchDate) {
    orFilters.push(
      { startDate: { gte: searchDate.start, lte: searchDate.end } },
      { endDate: { gte: searchDate.start, lte: searchDate.end } },
    );
  }

  const where: Prisma.TripWhereInput = {
    agencyId: session.user.agencyId,
    ...(status ? { status: status as TripStatus } : {}),
    ...(orFilters.length ? { OR: orFilters } : {}),
  };

  const trips = await prisma.trip.findMany({
    where,
    orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      passengers: {
        include: {
          passenger: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          documents: true,
          conversations: true,
          alerts: true,
        },
      },
    },
  });

  const tripListQuery = new URLSearchParams();
  if (q) tripListQuery.set('q', q);
  if (status) tripListQuery.set('status', status);
  tripListQuery.set('deleted', '1');
  const tripDeleteRedirect = `/dashboard/trips?${tripListQuery.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operacao"
        title="Jornadas Globais"
        description="Visao transversal das jornadas da agencia com status, passageiros vinculados e prioridade operacional."
        actions={(
          <Link
            href="/dashboard/trips/new"
            className="rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
          >
            Nova jornada
          </Link>
        )}
      />

      {searchParams.deleted === '1' && (
        <div className="rounded-[24px] border border-[#cfe7d6] bg-[#edf9f0] px-5 py-4 text-sm text-[#11623a]">
          Viagem excluida com sucesso.
        </div>
      )}

      <SectionCard title="Busca operacional" description="Busque por titulo, destino, codigo interno ou data no formato AAAA-MM-DD.">
        <form className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b857b]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Ex: Italia, TRIP-2026-014 ou 2026-06-20"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] py-3 pl-11 pr-4 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <select
            name="status"
            defaultValue={status}
            className="rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
          >
            <option value="">Todos os status</option>
            {TRIP_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c8d6c6]"
          >
            Filtrar
          </button>
        </form>
      </SectionCard>

      <div className="grid gap-4">
        {trips.length === 0 ? (
          <SectionCard title="Nenhuma viagem encontrada" description="Ajuste os filtros ou crie uma nova jornada para comecar a operar.">
            <div className="rounded-[24px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-6 py-10 text-center text-sm text-[#5b665d]">
              Sem resultados para a busca atual.
            </div>
          </SectionCard>
        ) : trips.map((trip) => {
          const operational = readTripOperationalMeta(trip.structuredMetadata);
          const activeForWhatsApp = isTripActiveForWhatsApp(trip);

          return (
            <div
              key={trip.id}
              className="block rounded-[28px] border border-[#d9e2d5] bg-white/95 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)] transition hover:border-[#c8d6c6] hover:shadow-[0_30px_80px_rgba(16,24,40,0.08)]"
            >
              <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={`/dashboard/trips/${trip.id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#1f6b46] transition hover:border-[#c8d6c6]"
                >
                  Abrir viagem
                </Link>
                <DeleteResourceButton
                  endpoint={`/api/admin/trips/${trip.id}`}
                  redirectTo={tripDeleteRedirect}
                  dialogTitle="Excluir viagem"
                  dialogDescription={`A viagem ${trip.title} sera removida da operacao.`}
                  idleLabel="Excluir"
                  pendingLabel="Excluindo..."
                  successMessage="Viagem excluida com sucesso."
                  errorMessage="Nao foi possivel excluir a viagem."
                  className="inline-flex items-center gap-2 rounded-xl border border-[#efc8c1] bg-[#fff5f3] px-3 py-2 text-sm font-semibold text-[#9b3528] transition hover:bg-[#ffecea] disabled:opacity-60"
                />
              </div>

              <Link href={`/dashboard/trips/${trip.id}`} className="block">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#142018]">{trip.title}</h2>
                        <StatusBadge tone={getTripStatusTone(trip.status)}>{getTripStatusLabel(trip.status)}</StatusBadge>
                        {activeForWhatsApp && <StatusBadge tone="success">WhatsApp ativo</StatusBadge>}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-[#5b665d]">
                        <span className="inline-flex items-center gap-2">
                          <PlaneTakeoff className="h-4 w-4 text-[#1f6b46]" />
                          {trip.destination || 'Destino nao informado'}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <CalendarRange className="h-4 w-4 text-[#1f6b46]" />
                          {format(trip.startDate, "dd 'de' MMM", { locale: ptBR })} ate {format(trip.endDate, "dd 'de' MMM yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-2 text-[#38463a]">
                        Codigo: <span className="font-semibold text-[#142018]">{operational.internalCode || 'Nao definido'}</span>
                      </div>
                      <div className="rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-2 text-[#38463a]">
                        Passageiros: <span className="font-semibold text-[#142018]">{trip.passengers.length}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-[#5b665d]">
                      <UsersRound className="h-4 w-4 text-[#1f6b46]" />
                      {trip.passengers.length ? (
                        trip.passengers.map((passenger) => (
                          <span key={passenger.id} className="rounded-full border border-[#d9e2d5] bg-[#fbfcfa] px-3 py-1">
                            {passenger.passenger?.name ?? passenger.name}
                          </span>
                        ))
                      ) : (
                        <span>Sem passageiros vinculados</span>
                      )}
                    </div>
                  </div>

                  <div className="grid min-w-[220px] gap-3 text-sm text-[#5b665d]">
                    <div className="rounded-[22px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Relacionamentos</p>
                      <div className="mt-3 space-y-2">
                        <p>{trip._count.documents} documentos</p>
                        <p>{trip._count.conversations} conversas</p>
                        <p>{trip._count.alerts} alertas</p>
                      </div>
                    </div>
                    {activeForWhatsApp && (
                      <div className="rounded-[22px] border border-[#cfe1cc] bg-[#ecf6ea] p-4 text-[#163020]">
                        <p className="inline-flex items-center gap-2 text-sm font-semibold">
                          <MessageSquareShare className="h-4 w-4" />
                          Contexto prioritario no WhatsApp
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
