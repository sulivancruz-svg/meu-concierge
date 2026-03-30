import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Mail, Phone, Search, UsersRound } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeleteResourceButton } from '@/components/ui/delete-resource-button';
import { DatabaseUnavailableNotice } from '@/components/ui/database-unavailable-notice';
import { isPrismaConnectionError } from '@/lib/prisma-error';

function portalTone(status: string) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'INVITED') return 'info' as const;
  if (status === 'SUSPENDED') return 'danger' as const;
  return 'warning' as const;
}

export default async function PassengersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; deleted?: string };
}) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const q = searchParams.q ?? '';
  const page = parseInt(searchParams.page ?? '1', 10);
  const limit = 20;
  const agencyId = session.user.agencyId;

  const where = {
    agencyId,
    deletedAt: null as null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  let passengers;
  let total;
  try {
    [passengers, total] = await Promise.all([
      prisma.passenger.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              tripPassengers: true,
              companions: true,
              conversations: true,
            },
          },
          tripPassengers: {
            include: {
              trip: {
                select: {
                  title: true,
                  status: true,
                  startDate: true,
                },
              },
            },
            orderBy: { trip: { startDate: 'desc' } },
            take: 1,
          },
        },
      }),
      prisma.passenger.count({ where }),
    ]);
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      throw error;
    }

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Passageiros"
          title="Base de passageiros"
          description="Busque por nome, WhatsApp ou e-mail e entre rapido no contexto operacional de cada passageiro."
        />
        <DatabaseUnavailableNotice context="A lista de passageiros nao foi carregada porque a conexao com o banco falhou." />
      </div>
    );
  }

  const passengerListQuery = new URLSearchParams();
  if (q) passengerListQuery.set('q', q);
  if (page > 1) passengerListQuery.set('page', String(page));
  passengerListQuery.set('deleted', '1');
  const passengerDeleteRedirect = `/dashboard/passengers?${passengerListQuery.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Passageiros"
        title="Base de passageiros"
        description="Busque por nome, WhatsApp ou e-mail e entre rapido no contexto operacional de cada passageiro."
        actions={(
          <Link
            href="/dashboard/passengers/new"
            className="rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
          >
            Novo passageiro
          </Link>
        )}
      />

      {searchParams.deleted === '1' && (
        <div className="rounded-[24px] border border-[#cfe7d6] bg-[#edf9f0] px-5 py-4 text-sm text-[#11623a]">
          Passageiro excluido com sucesso.
        </div>
      )}

      <SectionCard title="Busca e gestao" description="Listagem conectada ao banco com foco em rapidez operacional.">
        <form className="mb-5 flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b857b]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome, telefone WhatsApp ou e-mail"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] py-3 pl-11 pr-4 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>
          <button
            type="submit"
            className="rounded-2xl border border-[#d9e2d5] bg-white px-5 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c8d6c6]"
          >
            Buscar
          </button>
        </form>

        {passengers.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-[#ecf6ea] text-[#1f6b46]">
              <UsersRound className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[#142018]">
              {q ? 'Nenhum passageiro encontrado' : 'Sua base de passageiros ainda esta vazia'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#5b665d]">
              {q
                ? 'Ajuste a busca ou cadastre um novo passageiro para iniciar a operacao.'
                : 'Cadastre o primeiro passageiro para organizar viagens, companions, documentos e conversas.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {passengers.map((passenger) => {
              const latestTrip = passenger.tripPassengers[0]?.trip;

              return (
                <div
                  key={passenger.id}
                  className="block rounded-[26px] border border-[#d9e2d5] bg-[#fbfcfa] p-5 transition hover:border-[#c6d7c7] hover:bg-white"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/dashboard/passengers/${passenger.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#1f6b46] transition hover:border-[#c8d6c6]"
                    >
                      Abrir perfil
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <DeleteResourceButton
                      endpoint={`/api/admin/passengers/${passenger.id}`}
                      redirectTo={passengerDeleteRedirect}
                      dialogTitle="Excluir passageiro"
                      dialogDescription={`O cadastro de ${passenger.name} deixara de aparecer na operacao.`}
                      idleLabel="Excluir"
                      pendingLabel="Excluindo..."
                      successMessage="Passageiro excluido com sucesso."
                      errorMessage="Nao foi possivel excluir o passageiro."
                      className="inline-flex items-center gap-2 rounded-xl border border-[#efc8c1] bg-[#fff5f3] px-3 py-2 text-sm font-semibold text-[#9b3528] transition hover:bg-[#ffecea] disabled:opacity-60"
                    />
                  </div>

                  <Link href={`/dashboard/passengers/${passenger.id}`} className="block">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ecf6ea] text-sm font-semibold text-[#1f6b46]">
                          {passenger.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-[#142018]">{passenger.name}</p>
                            <StatusBadge tone={portalTone(passenger.portalStatus)}>{passenger.portalStatus}</StatusBadge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-[#5b665d]">
                            <span className="inline-flex items-center gap-2">
                              <Phone className="h-4 w-4 text-[#1f6b46]" />
                              {passenger.phone || 'WhatsApp nao informado'}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Mail className="h-4 w-4 text-[#1f6b46]" />
                              {passenger.email || 'E-mail nao informado'}
                            </span>
                          </div>
                          {latestTrip && (
                            <p className="mt-3 text-sm text-[#38463a]">
                              Ultima jornada: <span className="font-semibold text-[#142018]">{latestTrip.title}</span> em{' '}
                              {format(latestTrip.startDate, "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-[#5b665d]">
                        <span className="rounded-full bg-white px-3 py-1.5 font-medium text-[#38463a]">
                          {passenger._count.tripPassengers} viagem{passenger._count.tripPassengers === 1 ? '' : 's'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1.5 font-medium text-[#38463a]">
                          {passenger._count.companions} companion{passenger._count.companions === 1 ? '' : 's'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1.5 font-medium text-[#38463a]">
                          {passenger._count.conversations} conversa{passenger._count.conversations === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {total > limit && (
        <div className="flex items-center justify-end gap-3 text-sm text-[#5b665d]">
          <span>
            Pagina {page} de {Math.max(1, Math.ceil(total / limit))}
          </span>
          {page > 1 && (
            <Link href={`/dashboard/passengers?q=${encodeURIComponent(q)}&page=${page - 1}`} className="rounded-xl border border-[#d9e2d5] px-3 py-2 font-semibold text-[#142018]">
              Anterior
            </Link>
          )}
          {page * limit < total && (
            <Link href={`/dashboard/passengers?q=${encodeURIComponent(q)}&page=${page + 1}`} className="rounded-xl border border-[#d9e2d5] px-3 py-2 font-semibold text-[#142018]">
              Proxima
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
