import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarRange, FileStack, Hotel, MapPinned, MessageSquareText, PlaneTakeoff } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { buildPassengerPortalEntryUrl } from '@/lib/portal-access';
import { TripTimeline } from '@/components/trips/trip-timeline';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { serializeTripDocuments } from '@/modules/documents/document-presentation';
import { buildTripTimeline, groupTripTimeline } from '@/modules/trips/timeline';

export default async function PassengerAreaPage() {
  const session = await getSession();
  if (!session) return null;

  const agencyId = session.user.agencyId;
  const trip = await prisma.trip.findFirst({
    where: { agencyId, status: { in: ['READY', 'IN_PROGRESS', 'COMPLETED'] } },
    orderBy: { startDate: 'asc' },
    include: {
      agency: { select: { name: true, supportWhatsApp: true, supportEmail: true } },
      passengers: { include: { passenger: true }, take: 4 },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 8 },
      alerts: { where: { resolvedAt: null }, orderBy: { createdAt: 'desc' }, take: 4 },
      flightSegments: { orderBy: { departureAt: 'asc' }, take: 4 },
      hotelBookings: { orderBy: { checkIn: 'asc' }, take: 2 },
      transportBookings: { orderBy: { scheduledAt: 'asc' }, take: 4 },
      tourBookings: { orderBy: { scheduledAt: 'asc' }, take: 3 },
      trainBookings: { orderBy: { departureAt: 'asc' }, take: 4 },
      insurancePolicies: true,
      notes: { orderBy: { createdAt: 'desc' }, take: 4 },
    },
  });

  const tripDocuments = trip ? await serializeTripDocuments(trip.documents) : [];
  const timelineGroups = trip ? groupTripTimeline(buildTripTimeline({
    flightSegments: trip.flightSegments,
    hotelBookings: trip.hotelBookings,
    transportBookings: trip.transportBookings,
    tourBookings: trip.tourBookings,
    trainBookings: trip.trainBookings,
    insurancePolicies: trip.insurancePolicies,
    notes: [],
    documents: tripDocuments,
  }, { viewer: 'passenger' })) : [];

  const leadPassenger = trip?.passengers.find((item) => item.passengerId) ?? trip?.passengers[0];
  const portalLink = trip && leadPassenger?.passengerId
    ? buildPassengerPortalEntryUrl({
        tripId: trip.id,
        passengerId: leadPassenger.passengerId,
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Preview"
        title="Area do Passageiro"
        description="Experiencia base do passageiro com jornada, documentos e acompanhamento em tempo real. Nesta etapa, esta pagina funciona como cockpit de preview do portal."
      />

      {!trip ? (
        <SectionCard title="Nenhuma viagem pronta para preview" description="Cadastre uma viagem com passageiros e documentos para visualizar a experiencia do portal.">
          <div className="rounded-3xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] p-10 text-center text-sm text-[#5b665d]">
            O portal do passageiro sera alimentado automaticamente quando houver jornadas ativas.
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Passageiros" value={trip.passengers.length} detail="Perfis vinculados ao portal" icon={MessageSquareText} />
            <StatCard title="Documentos" value={trip.documents.length} detail="Arquivos liberados para consulta" icon={FileStack} tone="accent" />
            <StatCard title="Alertas" value={trip.alerts.length} detail="Comunicacoes importantes" icon={CalendarRange} tone={trip.alerts.length > 0 ? 'warn' : 'default'} />
            <StatCard title="Suporte" value={trip.agency.supportWhatsApp || trip.agency.supportEmail || 'Agencia'} detail="Canal principal do passageiro" icon={MapPinned} />
          </div>

          <SectionCard title={trip.title} description={`${trip.destination ?? 'Destino'} · ${format(trip.startDate, "d 'de' MMM", { locale: ptBR })} ate ${format(trip.endDate, "d 'de' MMM", { locale: ptBR })}`}>
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="rounded-[24px] bg-[#173a27] p-5 text-white">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge tone={trip.status === 'IN_PROGRESS' ? 'success' : trip.status === 'READY' ? 'info' : 'neutral'}>
                      {trip.status}
                    </StatusBadge>
                    <p className="text-sm text-white/70">{trip.agency.name}</p>
                  </div>
                  <p className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
                    Uma unica jornada para passageiro, agencia e atendimento inteligente.
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/74">
                    Este preview concentra a base que depois sera usada no portal real e no WhatsApp com IA: contexto da viagem, documentos liberados, alertas e timeline.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[24px] border border-[#d9e2d5] bg-white p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <PlaneTakeoff className="h-4 w-4 text-[#1f6b46]" />
                      <p className="font-semibold text-[#142018]">Passageiros</p>
                    </div>
                    <div className="space-y-2">
                      {trip.passengers.map((passenger) => (
                        <div key={passenger.id} className="rounded-2xl bg-[#f6f7f2] px-3 py-2 text-sm text-[#38463a]">
                          {passenger.passenger?.name ?? passenger.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#d9e2d5] bg-white p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-[#1f6b46]" />
                      <p className="font-semibold text-[#142018]">Documentos liberados</p>
                    </div>
                    <div className="space-y-2">
                      {trip.documents.length === 0 ? (
                        <p className="text-sm text-[#5b665d]">Nenhum documento anexado ainda.</p>
                      ) : trip.documents.map((document) => (
                        <div key={document.id} className="rounded-2xl bg-[#f6f7f2] px-3 py-2 text-sm text-[#38463a]">
                          {document.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {portalLink && (
                  <div className="rounded-[24px] border border-[#d9e2d5] bg-white p-5">
                    <p className="text-sm font-semibold text-[#142018]">Link real do portal</p>
                    <p className="mt-2 break-all text-sm text-[#5b665d]">{portalLink}</p>
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-[#d9e2d5] bg-white p-6">
                <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Timeline do passageiro</p>
                <TripTimeline
                  groups={timelineGroups}
                  emptyMessage="Nenhum marco operacional preenchido ainda."
                  variant="portal"
                />
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
