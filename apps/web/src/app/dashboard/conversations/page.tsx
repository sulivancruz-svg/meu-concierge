import { Bot, MessageCircleReply, PhoneCall, PlaneTakeoff } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ConversationsWorkspace } from '@/components/conversations/conversations-workspace';
import { DatabaseUnavailableNotice } from '@/components/ui/database-unavailable-notice';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { isPrismaConnectionError } from '@/lib/prisma-error';
import { getConversationDetail, listConversations } from '@/modules/conversations/service';

export default async function ConversationsPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const agencyId = session.user.agencyId;
  let conversations;
  let openCount;
  let linkedToTrip;
  let totalConversations;
  let passengerOptions;
  let tripOptions;
  try {
    [conversations, openCount, linkedToTrip, totalConversations, passengerOptions, tripOptions] = await Promise.all([
      listConversations(agencyId),
      prisma.conversation.count({ where: { agencyId, status: 'OPEN' } }),
      prisma.conversation.count({ where: { agencyId, tripId: { not: null } } }),
      prisma.conversation.count({ where: { agencyId } }),
      prisma.passenger.findMany({
        where: { agencyId, deletedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true },
      }),
      prisma.trip.findMany({
        where: {
          agencyId,
          status: { in: ['READY', 'IN_PROGRESS', 'COMPLETED'] },
        },
        orderBy: { startDate: 'asc' },
        select: { id: true, title: true },
      }),
    ]);
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      throw error;
    }

    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Inbox"
          title="Conversas"
          description="Fluxo de atendimento com passageiro, historico cronologico e assistente mockado usando os dados reais da viagem."
        />
        <DatabaseUnavailableNotice context="A inbox nao foi carregada porque a conexao com o banco falhou." />
      </div>
    );
  }

  const waitingAssistant = conversations.filter((conversation) => conversation.lastMessage?.direction === 'INBOUND').length;
  let initialConversation = null;
  try {
    initialConversation = conversations[0]
      ? await getConversationDetail(agencyId, conversations[0].id)
      : null;
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Conversas"
        description="Fluxo de atendimento com passageiro, historico cronologico e assistente mockado usando os dados reais da viagem."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Conversas abertas" value={openCount} detail="Atendimento em curso" icon={PhoneCall} tone="warn" />
        <StatCard title="Ligadas a viagem" value={linkedToTrip} detail="Com contexto operacional" icon={PlaneTakeoff} />
        <StatCard title="Esperando resposta" value={waitingAssistant} detail="Ultima fala do passageiro" icon={MessageCircleReply} tone={waitingAssistant > 0 ? 'warn' : 'default'} />
        <StatCard title="Mock IA" value={totalConversations} detail="Conversas prontas para simular WhatsApp" icon={Bot} />
      </div>

      <ConversationsWorkspace
        initialConversations={conversations}
        initialConversation={initialConversation}
        passengerOptions={passengerOptions.map((passenger) => ({
          value: passenger.id,
          label: passenger.name,
          phone: passenger.phone,
        }))}
        tripOptions={tripOptions.map((trip) => ({
          value: trip.id,
          label: trip.title,
        }))}
      />
    </div>
  );
}
