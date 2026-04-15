'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bot,
  FileUp,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ConversationDetail, ConversationListItem } from '@/modules/conversations/types';

type Option = {
  value: string;
  label: string;
};

type Props = {
  initialConversations: ConversationListItem[];
  initialConversation: ConversationDetail | null;
  passengerOptions: Array<Option & { phone: string | null }>;
  tripOptions: Option[];
};

function ConversationRelativeTime({ value }: { value: string | null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  const label = mounted
    ? formatDistanceToNow(parsed, { addSuffix: true, locale: ptBR })
    : format(parsed, "dd/MM 'às' HH:mm", { locale: ptBR });

  return <>{label}</>;
}

function statusTone(status: string) {
  if (status === 'OPEN') return 'warning' as const;
  if (status === 'CLOSED') return 'neutral' as const;
  return 'danger' as const;
}

function modeLabel(mode: string) {
  if (mode === 'passenger') return 'Passageiro';
  if (mode === 'assistant') return 'Assistente';
  return 'Agencia';
}

function waStatusTone(status: string | null) {
  if (status === 'FAILED') return 'danger' as const;
  if (status === 'DELIVERED' || status === 'READ') return 'success' as const;
  if (status === 'SENT') return 'info' as const;
  return 'neutral' as const;
}

export function ConversationsWorkspace({
  initialConversations,
  initialConversation,
  passengerOptions,
  tripOptions,
}: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState(initialConversation?.id ?? initialConversations[0]?.id ?? '');
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(initialConversation);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sendMode, setSendMode] = useState<'passenger' | 'assistant' | 'agent'>('passenger');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConversation, setNewConversation] = useState({
    passengerId: '',
    tripId: '',
    phone: '',
    contextSummary: '',
  });
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return conversations;
    }

    return conversations.filter((conversation) => (
      conversation.phone.toLowerCase().includes(normalized) ||
      conversation.passengerName?.toLowerCase().includes(normalized) ||
      conversation.tripTitle?.toLowerCase().includes(normalized) ||
      conversation.lastMessage?.body.toLowerCase().includes(normalized)
    ));
  }, [conversations, query]);

  useEffect(() => {
    if (!selectedConversationId) {
      setActiveConversation(null);
      return;
    }

    if (activeConversation?.id === selectedConversationId) {
      return;
    }

    startTransition(async () => {
      setError('');
      const response = await fetch(`/api/admin/conversations/${selectedConversationId}`);
      if (!response.ok) {
        setError('Nao foi possivel carregar a conversa.');
        return;
      }

      const data = await response.json() as ConversationDetail;
      setActiveConversation(data);
    });
  }, [activeConversation?.id, selectedConversationId]);

  async function refreshConversations(preferredId?: string) {
    const response = await fetch('/api/admin/conversations');
    if (!response.ok) {
      throw new Error('Nao foi possivel atualizar o inbox.');
    }

    const data = await response.json() as { items: ConversationListItem[] };
    setConversations(data.items);

    const nextId = preferredId ?? selectedConversationId ?? data.items[0]?.id ?? '';
    if (nextId) {
      setSelectedConversationId(nextId);
      const detailResponse = await fetch(`/api/admin/conversations/${nextId}`);
      if (detailResponse.ok) {
        const detail = await detailResponse.json() as ConversationDetail;
        setActiveConversation(detail);
      }
    }
  }

  async function handleCreateConversation() {
    startTransition(async () => {
      try {
        setError('');
        const response = await fetch('/api/admin/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConversation),
        });

        if (!response.ok) {
          throw new Error('Nao foi possivel criar a conversa.');
        }

        const data = await response.json() as { id: string };
        setShowNewConversation(false);
        setNewConversation({ passengerId: '', tripId: '', phone: '', contextSummary: '' });
        await refreshConversations(data.id);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Erro interno.');
      }
    });
  }

  async function handleSendMessage() {
    if (!selectedConversationId || !draft.trim()) {
      return;
    }

    startTransition(async () => {
      try {
        setError('');
        const response = await fetch(`/api/admin/conversations/${selectedConversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: draft,
            mode: sendMode,
          }),
        });

        if (!response.ok) {
          throw new Error('Nao foi possivel enviar a mensagem.');
        }

        const data = await response.json() as { conversation: ConversationDetail };
        setDraft('');
        setActiveConversation(data.conversation);
        setConversations((current) => {
          const item: ConversationListItem = {
            id: data.conversation.id,
            passengerId: data.conversation.passengerId,
            passengerName: data.conversation.passengerName,
            tripId: data.conversation.tripId,
            tripTitle: data.conversation.tripTitle,
            phone: data.conversation.phone,
            status: data.conversation.status,
            contextSummary: data.conversation.contextSummary,
            lastMessageAt: data.conversation.lastMessageAt,
            createdAt: data.conversation.createdAt,
            lastMessage: data.conversation.lastMessage,
          };

          return [item, ...current.filter((conversation) => conversation.id !== item.id)];
        });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Erro interno.');
      }
    });
  }

  async function handleSendDocument(documentId: string) {
    if (!selectedConversationId) {
      return;
    }

    startTransition(async () => {
      try {
        setError('');
        const response = await fetch(`/api/admin/conversations/${selectedConversationId}/documents/${documentId}/send`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Nao foi possivel enviar o documento no WhatsApp.');
        }

        const data = await response.json() as { conversation: ConversationDetail };
        setActiveConversation(data.conversation);
        setConversations((current) => {
          const item: ConversationListItem = {
            id: data.conversation.id,
            passengerId: data.conversation.passengerId,
            passengerName: data.conversation.passengerName,
            tripId: data.conversation.tripId,
            tripTitle: data.conversation.tripTitle,
            phone: data.conversation.phone,
            status: data.conversation.status,
            contextSummary: data.conversation.contextSummary,
            lastMessageAt: data.conversation.lastMessageAt,
            createdAt: data.conversation.createdAt,
            lastMessage: data.conversation.lastMessage,
          };

          return [item, ...current.filter((conversation) => conversation.id !== item.id)];
        });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Erro interno.');
      }
    });
  }

  function syncPhoneFromPassenger(passengerId: string) {
    const passenger = passengerOptions.find((item) => item.value === passengerId);
    setNewConversation((current) => ({
      ...current,
      passengerId,
      phone: passenger?.phone ?? current.phone,
    }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="rounded-[28px] border border-[#d9e2d5] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Inbox</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#142018]">Conversas</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowNewConversation((current) => !current)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Nova
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-3 py-2">
            <Search className="h-4 w-4 text-[#7b857b]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por passageiro, telefone ou viagem"
              className="w-full bg-transparent text-sm text-[#142018] outline-none placeholder:text-[#8c978d]"
            />
          </div>

          {showNewConversation && (
            <div className="mt-4 space-y-3 rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-4">
              <p className="text-sm font-semibold text-[#142018]">Criar conversa</p>
              <select
                value={newConversation.passengerId}
                onChange={(event) => syncPhoneFromPassenger(event.target.value)}
                className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-3 py-3 text-sm text-[#142018] outline-none"
              >
                <option value="">Selecionar passageiro</option>
                {passengerOptions.map((passenger) => (
                  <option key={passenger.value} value={passenger.value}>{passenger.label}</option>
                ))}
              </select>
              <select
                value={newConversation.tripId}
                onChange={(event) => setNewConversation((current) => ({ ...current, tripId: event.target.value }))}
                className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-3 py-3 text-sm text-[#142018] outline-none"
              >
                <option value="">Resolver viagem ativa automaticamente</option>
                {tripOptions.map((trip) => (
                  <option key={trip.value} value={trip.value}>{trip.label}</option>
                ))}
              </select>
              <input
                value={newConversation.phone}
                onChange={(event) => setNewConversation((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Telefone"
                className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-3 py-3 text-sm text-[#142018] outline-none placeholder:text-[#8c978d]"
              />
              <textarea
                value={newConversation.contextSummary}
                onChange={(event) => setNewConversation((current) => ({ ...current, contextSummary: event.target.value }))}
                placeholder="Resumo de contexto opcional"
                className="min-h-[90px] w-full rounded-2xl border border-[#d9e2d5] bg-white px-3 py-3 text-sm text-[#142018] outline-none placeholder:text-[#8c978d]"
              />
              <button
                type="button"
                onClick={handleCreateConversation}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] disabled:opacity-60"
              >
                {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
                Criar conversa
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setSelectedConversationId(conversation.id)}
              className={`w-full rounded-[24px] border p-4 text-left transition ${
                selectedConversationId === conversation.id
                  ? 'border-[#b8d0bb] bg-[#edf6ef]'
                  : 'border-[#d9e2d5] bg-white hover:border-[#c8d6c6]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#142018]">{conversation.passengerName ?? conversation.phone}</p>
                    <StatusBadge tone={statusTone(conversation.status)}>{conversation.status}</StatusBadge>
                  </div>
                  <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-[#7b857b]">
                    {conversation.tripTitle ?? 'Sem viagem vinculada'}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-[#5b665d]">{conversation.lastMessage?.body ?? 'Sem mensagens ainda.'}</p>
                </div>
                <p className="shrink-0 text-xs text-[#7b857b]">
                  <ConversationRelativeTime value={conversation.lastMessageAt} />
                </p>
              </div>
            </button>
          ))}

          {filteredConversations.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-4 py-10 text-center text-sm text-[#5b665d]">
              Nenhuma conversa encontrada.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[32px] border border-[#d9e2d5] bg-white shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
        {!activeConversation ? (
          <div className="flex min-h-[680px] items-center justify-center px-6 text-center">
            <div className="max-w-md">
              <MessageSquareText className="mx-auto h-8 w-8 text-[#1f6b46]" />
              <p className="mt-4 text-lg font-semibold text-[#142018]">Selecione uma conversa</p>
              <p className="mt-2 text-sm leading-6 text-[#5b665d]">
                Abra uma thread existente ou crie uma nova conversa para testar o fluxo do assistente mockado com dados reais da viagem.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[680px] flex-col">
            <div className="border-b border-[#edf1ea] px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#142018]">
                      {activeConversation.passengerName ?? activeConversation.phone}
                    </h2>
                    <StatusBadge tone={statusTone(activeConversation.status)}>{activeConversation.status}</StatusBadge>
                    <StatusBadge tone="info">Mock IA ativo</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-[#5b665d]">{activeConversation.phone}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#38463a]">
                    <span>{activeConversation.tripTitle ?? 'Sem viagem vinculada'}</span>
                    {activeConversation.tripId && (
                      <Link href={`/dashboard/trips/${activeConversation.tripId}`} className="font-semibold text-[#1f6b46]">
                        Abrir viagem
                      </Link>
                    )}
                    {activeConversation.passengerId && (
                      <Link href={`/dashboard/passengers/${activeConversation.passengerId}`} className="font-semibold text-[#1f6b46]">
                        Abrir passageiro
                      </Link>
                    )}
                  </div>
                </div>

                <div className="rounded-[22px] bg-[#f6f7f2] px-4 py-3 text-sm text-[#38463a]">
                  <p className="font-semibold text-[#142018]">Como testar</p>
                  <p className="mt-2 max-w-sm leading-6">
                    Envie a mensagem como <strong>Passageiro</strong> para disparar a resposta do assistente com base nos dados reais da viagem.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              {activeConversation.messages.map((message) => {
                const isInbound = message.direction === 'INBOUND';
                const isAssistant = message.role === 'ASSISTANT';
                const isAgent = message.role === 'SYSTEM';

                return (
                  <div key={message.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[86%] rounded-[26px] px-4 py-4 ${
                      isInbound
                        ? 'bg-[#f6f7f2] text-[#142018]'
                        : isAssistant
                          ? 'bg-[#173a27] text-white'
                          : 'bg-[#e8f2ff] text-[#163252]'
                    }`}>
                      <div className="mb-2 flex items-center gap-2">
                        {isInbound ? <UserRound className="h-4 w-4" /> : isAssistant ? <Bot className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
                          {isInbound ? 'Passageiro' : isAssistant ? 'Assistente mock' : 'Agencia'}
                        </p>
                      </div>
                      <p className="text-sm leading-6">{message.body}</p>
                      {!isInbound && message.channel === 'WHATSAPP' && (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone={waStatusTone(message.waStatus)}>
                              WhatsApp {message.waStatus ?? 'PENDENTE'}
                            </StatusBadge>
                            {message.waMessageId && (
                              <span className={`text-xs ${isInbound ? 'text-[#7b857b]' : 'text-white/70'}`}>
                                ID {message.waMessageId}
                              </span>
                            )}
                          </div>
                          {message.waErrorMsg && (
                            <p className={`text-xs leading-5 ${isAssistant ? 'text-[#ffd8d2]' : 'text-[#8f2d22]'}`}>
                              Falha de entrega: {message.waErrorMsg}
                            </p>
                          )}
                        </div>
                      )}
                      {message.suggestions.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion) => (
                            <div key={suggestion.id} className="flex flex-wrap gap-2">
                              <Link
                                href={suggestion.downloadUrl ?? '#'}
                                target="_blank"
                                className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                                  isInbound ? 'border-[#d9e2d5] bg-white text-[#142018]' : 'border-white/20 bg-white/10 text-white'
                                } ${!suggestion.downloadUrl ? 'pointer-events-none opacity-60' : ''}`}
                              >
                                {suggestion.categoryLabel}: {suggestion.title}
                              </Link>
                              {!isInbound && (
                                <button
                                  type="button"
                                  onClick={() => handleSendDocument(suggestion.id)}
                                  disabled={isPending}
                                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${
                                    isAssistant
                                      ? 'border-white/20 bg-white/10 text-white'
                                      : 'border-[#d9e2d5] bg-white text-[#142018]'
                                  } disabled:opacity-60`}
                                >
                                  <FileUp className="h-3.5 w-3.5" />
                                  Enviar no WhatsApp
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className={`mt-3 text-xs ${isInbound ? 'text-[#7b857b]' : 'text-white/68'}`}>
                        {format(new Date(message.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#edf1ea] px-6 py-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(['passenger', 'assistant', 'agent'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSendMode(mode)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                      sendMode === mode
                        ? 'bg-[#173a27] text-white'
                        : 'bg-[#f1f4ef] text-[#425244]'
                    }`}
                  >
                    {modeLabel(mode)}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 lg:flex-row">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    sendMode === 'passenger'
                      ? 'Ex.: qual é meu voo? / que horas é meu check-in? / me mande meu voucher'
                      : sendMode === 'assistant'
                        ? 'Enviar uma resposta manual como assistente'
                        : 'Enviar uma mensagem manual da agência'
                  }
                  className="min-h-[108px] flex-1 rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-4 text-sm text-[#142018] outline-none placeholder:text-[#8c978d]"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isPending || !draft.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-[24px] bg-[#1f6b46] px-5 py-4 text-sm font-semibold text-white disabled:opacity-60 lg:w-[200px]"
                >
                  {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sendMode === 'passenger' ? 'Enviar e responder' : 'Enviar mensagem'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="xl:col-span-2 rounded-[20px] border border-[#f1c8c0] bg-[#fff4f2] px-4 py-3 text-sm text-[#8f2d22]">
          {error}
        </div>
      )}
    </div>
  );
}
