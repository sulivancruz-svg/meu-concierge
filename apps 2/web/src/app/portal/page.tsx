import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BedDouble,
  CalendarDays,
  CarFront,
  ExternalLink,
  FileText,
  LifeBuoy,
  LogOut,
  MapPin,
  PlaneTakeoff,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrainFront,
  TramFront,
} from 'lucide-react';
import { resolvePassengerPortalAccess } from '@/lib/portal-access';
import { getTripPortalSnapshot } from '@/modules/passenger-portal/data';
import { buildJourneyTimeline } from '@/modules/trips/timeline';
import { buildPassengerPortalViewModel } from '@/modules/passenger-portal/view-model';
import { TripTimeline } from '@/components/trips/trip-timeline';
import { StatusBadge } from '@/components/ui/status-badge';

function formatDateRange(startDate: Date, endDate: Date) {
  return `${format(startDate, "d 'de' MMM", { locale: ptBR })} ate ${format(endDate, "d 'de' MMM", { locale: ptBR })}`;
}

function formatDateTime(value: Date) {
  return format(value, "dd/MM 'as' HH:mm", { locale: ptBR });
}

function toneFromStatus(status: string) {
  if (status === 'Em andamento') return 'success' as const;
  if (status === 'Concluida') return 'neutral' as const;
  return 'info' as const;
}

function EmptyAccessState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f2f6ef_0%,#f8f3e9_42%,#f8faf7_100%)] px-5 py-10">
      <div className="mx-auto max-w-3xl rounded-[40px] border border-[#d9e2d5] bg-white/95 p-10 text-center shadow-[0_30px_90px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fff4de] text-[#8a5a00]">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-[#142018]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#5b665d]">{description}</p>
        <Link href="/login" className="mt-6 inline-flex rounded-2xl border border-[#d9e2d5] px-4 py-3 text-sm font-semibold text-[#142018]">
          Voltar para o app
        </Link>
      </div>
    </div>
  );
}

function PortalSection({
  title,
  eyebrow,
  icon: Icon,
  children,
}: {
  title: string;
  eyebrow?: string;
  icon?: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-[#dbe3d7] bg-white/95 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
      <div className="mb-5 flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef5ef] text-[#1f6b46]">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b857b]">{eyebrow}</p>}
          <h2 className="text-lg font-semibold text-[#142018]">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function OperationCard({
  icon: Icon,
  title,
  subtitle,
  meta,
  tone,
  badge,
}: {
  icon: typeof CalendarDays;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  tone: string;
  badge?: string | null;
}) {
  return (
    <div className="rounded-[24px] border border-[#e7ece5] bg-[#fbfcfa] p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#142018]">{title}</p>
            {badge && <StatusBadge tone="info">{badge}</StatusBadge>}
          </div>
          {subtitle && <p className="mt-1 text-sm text-[#38463a]">{subtitle}</p>}
          {meta && <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#7b857b]">{meta}</p>}
        </div>
      </div>
    </div>
  );
}

function ConciergeMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[28px] border border-[#dbe3d7] bg-white/95 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#142018]">{value}</p>
      <p className="mt-2 text-sm text-[#5b665d]">{detail}</p>
    </div>
  );
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: { token?: string; trip?: string; error?: string; logged_out?: string };
}) {
  const access = await resolvePassengerPortalAccess({
    accessToken: searchParams.token,
    preferredTripId: searchParams.trip,
  });

  if (!access) {
    return (
      <EmptyAccessState
        title={searchParams.logged_out ? 'Acesso encerrado' : 'Link invalido ou expirado'}
        description={searchParams.logged_out
          ? 'Sua sessao do portal foi encerrada com seguranca. Quando precisar, solicite um novo acesso ou use seu link autenticado.'
          : 'Este acesso do passageiro nao esta mais disponivel. Solicite um novo link diretamente para a agencia.'}
      />
    );
  }

  const snapshot = await getTripPortalSnapshot(access.tripId, access.passengerId);
  if (!snapshot) {
    return (
      <EmptyAccessState
        title="Viagem indisponivel"
        description="Nao foi possivel localizar os dados desta jornada para o passageiro informado."
      />
    );
  }

  const timeline = buildJourneyTimeline(snapshot, { viewer: 'passenger' });
  const view = buildPassengerPortalViewModel({ snapshot, timeline });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef4ed_0%,#f8f3e9_40%,#fafbf8_100%)] px-4 py-5 sm:px-5 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[38px] border border-[#dbe3d7] bg-[#163a27] px-6 py-7 text-white shadow-[0_35px_90px_rgba(13,24,18,0.24)] sm:px-8 sm:py-9">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="success">Concierge digital</StatusBadge>
                <StatusBadge tone={toneFromStatus(view.tripStatusLabel)}>{view.tripStatusLabel}</StatusBadge>
                <StatusBadge tone="info">Acesso seguro</StatusBadge>
              </div>

              <div className="space-y-3">
                <p className="text-sm uppercase tracking-[0.18em] text-white/62">Bem-vindo, {view.passengerName}</p>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{view.tripTitle}</h1>
                <p className="max-w-3xl text-base leading-7 text-white/78">
                  {view.destination} · {formatDateRange(snapshot.trip.startDate, snapshot.trip.endDate)}.
                  Aqui voce acompanha sua viagem de forma clara, com documentos, proximos momentos e contatos uteis em um unico lugar.
                </p>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-[30px] border border-white/10 bg-white/10 p-5 backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Suporte oficial</p>
                  <p className="mt-2 text-lg font-semibold text-white">{snapshot.trip.agency.name}</p>
                </div>
                <Link href="/portal/logout" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/82">
                  <LogOut className="h-4 w-4" />
                  Sair
                </Link>
              </div>
              <div className="mt-4 space-y-2 text-sm text-white/76">
                <p>{snapshot.trip.agency.supportWhatsApp || snapshot.trip.agency.supportPhone || 'Telefone nao informado'}</p>
                <p>{snapshot.trip.agency.supportEmail || 'E-mail nao informado'}</p>
              </div>
              <div className="mt-5 rounded-[22px] border border-white/10 bg-black/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/58">Proximo momento</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {view.upcomingItems[0]?.title ?? 'Sua agenda sera atualizada em breve'}
                </p>
                <p className="mt-1 text-sm text-white/72">
                  {view.upcomingItems[0]
                    ? `${format(view.upcomingItems[0].date, "dd/MM 'as' HH:mm", { locale: ptBR })} · ${view.upcomingItems[0].location || view.upcomingItems[0].summary || view.upcomingItems[0].eventType}`
                    : 'Sem evento imediato no momento.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ConciergeMetric label="Destino principal" value={view.destination} detail="Seu destino central desta jornada." />
          <ConciergeMetric label="Periodo" value={formatDateRange(snapshot.trip.startDate, snapshot.trip.endDate)} detail="Datas oficiais da viagem." />
          <ConciergeMetric label="Documentos importantes" value={view.importantDocuments.length} detail="Arquivos essenciais disponiveis para consulta." />
          <ConciergeMetric label="Proximos momentos" value={view.upcomingItems.length} detail="Eventos operacionais futuros ja organizados." />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <PortalSection title="Proximos momentos" eyebrow="Agenda imediata" icon={Sparkles}>
            <div className="grid gap-3 md:grid-cols-2">
              {view.upcomingItems.length === 0 ? (
                <p className="rounded-2xl bg-[#f6f7f2] px-4 py-4 text-sm text-[#5b665d]">Nenhum proximo evento foi registrado ainda.</p>
              ) : view.upcomingItems.map((item) => (
                <div key={item.key} className="rounded-[24px] border border-[#e7ece5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfa_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.03)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#142018]">{item.title}</p>
                      <p className="mt-1 text-sm text-[#5b665d]">{item.location || item.summary || item.eventType}</p>
                    </div>
                    <StatusBadge tone="info">{format(item.date, 'dd/MM HH:mm', { locale: ptBR })}</StatusBadge>
                  </div>
                  {item.document?.url && (
                    <Link href={item.document.url} target="_blank" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#1f6b46]">
                      Abrir documento
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </PortalSection>

          <PortalSection title="Documentos importantes" eyebrow="Tudo pronto para consulta" icon={FileText}>
            <div className="space-y-3">
              {view.importantDocuments.length === 0 ? (
                <p className="rounded-2xl bg-[#f6f7f2] px-4 py-4 text-sm text-[#5b665d]">Nenhum documento liberado ate o momento.</p>
              ) : view.importantDocuments.map((document) => (
                <div key={document.id} className="rounded-[24px] border border-[#e7ece5] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfa_100%)] p-4 shadow-[0_12px_30px_rgba(15,23,42,0.03)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#142018]">{document.title}</p>
                        {document.isEssential && <StatusBadge tone="success">Essencial</StatusBadge>}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#7b857b]">{document.categoryLabel}</p>
                    </div>
                    {document.downloadUrl && (
                      <Link href={document.downloadUrl} target="_blank" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1f6b46]">
                        Abrir
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PortalSection>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <PortalSection title="Timeline por dia" eyebrow="Sua jornada completa" icon={CalendarDays}>
            <TripTimeline
              groups={view.groupedTimeline}
              emptyMessage="Os detalhes operacionais ainda estao sendo organizados pela agencia."
              variant="portal"
            />
          </PortalSection>

          <div className="space-y-6">
            <PortalSection title="Resumo concierge" eyebrow="Leitura rapida da jornada" icon={Sparkles}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-[#e7ece5] bg-[#fbfcfa] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b857b]">Status da viagem</p>
                  <p className="mt-2 text-sm font-semibold text-[#142018]">{view.tripStatusLabel}</p>
                  <p className="mt-2 text-sm text-[#5b665d]">A agenda abaixo reflete os dados reais confirmados pela agencia.</p>
                </div>
                <div className="rounded-[24px] border border-[#e7ece5] bg-[#fbfcfa] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b857b]">Documentos liberados</p>
                  <p className="mt-2 text-sm font-semibold text-[#142018]">{view.importantDocuments.length} disponiveis</p>
                  <p className="mt-2 text-sm text-[#5b665d]">Quando houver voucher, ticket ou boarding pass, ele aparece aqui e na timeline.</p>
                </div>
              </div>
            </PortalSection>

            <PortalSection title="Contatos uteis" eyebrow="Ajuda quando precisar" icon={LifeBuoy}>
              <div className="space-y-3">
                {view.usefulContacts.map((contact, index) => (
                  <div key={`${contact.label}-${index}`} className="rounded-[24px] border border-[#e7ece5] bg-[#fbfcfa] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b857b]">{contact.label}</p>
                    <p className="mt-2 text-sm font-semibold text-[#142018]">{contact.primary}</p>
                    <p className="mt-1 text-sm text-[#5b665d]">{contact.secondary}</p>
                  </div>
                ))}
              </div>
            </PortalSection>

            <PortalSection title="Observacoes importantes" eyebrow="O que merece atencao" icon={ShieldCheck}>
              <div className="space-y-3">
                {view.importantNotes.length === 0 ? (
                  <p className="rounded-2xl bg-[#f6f7f2] px-4 py-4 text-sm text-[#5b665d]">Nenhuma observacao adicional no momento.</p>
                ) : view.importantNotes.map((note, index) => (
                  <div key={`${note.title}-${index}`} className="rounded-[24px] border border-[#e7ece5] bg-[#fbfcfa] p-4">
                    <p className="text-sm font-semibold text-[#142018]">{note.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[#5b665d]">{note.body}</p>
                  </div>
                ))}
              </div>
            </PortalSection>
          </div>
        </div>

        <PortalSection title="Sua operacao de viagem" eyebrow="Tudo organizado por etapa" icon={MapPin}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {view.sections.flights.map((flight) => (
              <OperationCard
                key={flight.id}
                icon={PlaneTakeoff}
                title={`${flight.airlineName || flight.airline} ${flight.flightNumber}`}
                subtitle={`${flight.origin} -> ${flight.destination}`}
                meta={formatDateTime(flight.departureAt)}
                tone="bg-[#ecf4ff] text-[#2453a6]"
                badge={flight.statusCode.replace(/_/g, ' ')}
              />
            ))}
            {view.sections.hotels.map((hotel) => (
              <OperationCard
                key={hotel.id}
                icon={BedDouble}
                title={hotel.hotelName}
                subtitle={hotel.address || 'Hospedagem confirmada'}
                meta={`Check-in ${formatDateTime(hotel.checkIn)}`}
                tone="bg-[#f6efe2] text-[#8a5a00]"
              />
            ))}
            {view.sections.transports.map((transport) => (
              <OperationCard
                key={transport.id}
                icon={transport.type === 'CAR_RENTAL' ? CarFront : TramFront}
                title={transport.name}
                subtitle={`${transport.pickupPoint || 'Origem a confirmar'}${transport.dropoffPoint ? ` -> ${transport.dropoffPoint}` : ''}`}
                meta={formatDateTime(transport.scheduledAt)}
                tone="bg-[#eef8f2] text-[#1f6b46]"
              />
            ))}
            {view.sections.tours.map((tour) => (
              <OperationCard
                key={tour.id}
                icon={Ticket}
                title={tour.name}
                subtitle={tour.meetingPoint || 'Local a confirmar'}
                meta={formatDateTime(tour.scheduledAt)}
                tone="bg-[#fff1e8] text-[#9a4f17]"
              />
            ))}
            {view.sections.trains.map((train) => (
              <OperationCard
                key={train.id}
                icon={TrainFront}
                title={`${train.operator}${train.trainNumber ? ` ${train.trainNumber}` : ''}`}
                subtitle={`${train.origin} -> ${train.destination}`}
                meta={formatDateTime(train.departureAt)}
                tone="bg-[#eef5fb] text-[#225982]"
              />
            ))}
            {view.sections.insurances.map((insurance) => (
              <OperationCard
                key={insurance.id}
                icon={ShieldCheck}
                title={`Seguro ${insurance.provider}`}
                subtitle={insurance.coverageType || 'Cobertura ativa'}
                meta={`Valido ate ${format(insurance.endDate, 'dd/MM/yyyy', { locale: ptBR })}`}
                tone="bg-[#edf5ef] text-[#255a3c]"
              />
            ))}
          </div>

          {Object.values(view.sections).every((items) => items.length === 0) && (
            <p className="rounded-2xl bg-[#f6f7f2] px-4 py-4 text-sm text-[#5b665d]">A operacao desta viagem ainda esta sendo montada pela agencia.</p>
          )}
        </PortalSection>
      </div>
    </div>
  );
}
