'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LoaderCircle, MapPin, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast-provider';

const ITEM_TYPES = [
  { value: 'FLIGHT',    label: 'Voo',        emoji: '✈️',  bg: 'bg-[#dbeafe]', text: 'text-[#1d4ed8]' },
  { value: 'HOTEL',     label: 'Hotel',       emoji: '🏨',  bg: 'bg-[#fef3c7]', text: 'text-[#92400e]' },
  { value: 'TRANSPORT', label: 'Transfer',    emoji: '🚌',  bg: 'bg-[#dcfce7]', text: 'text-[#166534]' },
  { value: 'TOUR',      label: 'Passeio',     emoji: '🎟️', bg: 'bg-[#ffedd5]', text: 'text-[#9a3412]' },
  { value: 'TRAIN',     label: 'Trem',        emoji: '🚂',  bg: 'bg-[#e0f2fe]', text: 'text-[#0369a1]' },
  { value: 'INSURANCE', label: 'Seguro',      emoji: '🛡️', bg: 'bg-[#ecfdf5]', text: 'text-[#065f46]' },
  { value: 'NOTE',      label: 'Observação',  emoji: '📝',  bg: 'bg-[#f3f4f6]', text: 'text-[#374151]' },
] as const;

type ItemTypeValue = typeof ITEM_TYPES[number]['value'];

type TripItem = {
  id: string;
  type: ItemTypeValue;
  title: string;
  providerName: string | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  confirmationCode: string | null;
  description: string | null;
  passengerId: string | null;
  sortOrder: number;
  createdAt: string;
};

type FormState = {
  type: ItemTypeValue;
  title: string;
  providerName: string;
  startAt: string;
  endAt: string;
  location: string;
  confirmationCode: string;
  description: string;
  passengerId: string;
};

type FlightLookupPayload = {
  title: string;
  providerName: string | null;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  confirmationCode: string | null;
  description: string | null;
};

const defaultForm: FormState = {
  type: 'FLIGHT',
  title: '',
  providerName: '',
  startAt: '',
  endAt: '',
  location: '',
  confirmationCode: '',
  description: '',
  passengerId: '',
};

function getTypeConfig(type: string) {
  return ITEM_TYPES.find(t => t.value === type) ?? ITEM_TYPES[0];
}

function formatDate(d: string | null) {
  if (!d) return null;
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return null;
  }
}

function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

type Props = {
  tripId: string;
  initialItems?: TripItem[];
};

export function TripItemsManager({ tripId, initialItems }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<TripItem[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (initialItems) return;
    setLoading(true);
    fetch(`/api/admin/trips/${tripId}/items`)
      .then(r => r.json())
      .then((data: TripItem[]) => setItems(data))
      .catch(() => toast({ title: 'Erro ao carregar itens', variant: 'error' }))
      .finally(() => setLoading(false));
  }, [tripId, initialItems, toast]);

  function openCreate() {
    setEditingId(null);
    setForm(defaultForm);
    setShowForm(true);
  }

  function openEdit(item: TripItem) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      title: item.title,
      providerName: item.providerName ?? '',
      startAt: item.startAt ? item.startAt.slice(0, 16) : '',
      endAt: item.endAt ? item.endAt.slice(0, 16) : '',
      location: item.location ?? '',
      confirmationCode: item.confirmationCode ?? '',
      description: item.description ?? '',
      passengerId: item.passengerId ?? '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(defaultForm);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleFlightLookup() {
    if (form.type !== 'FLIGHT') return;

    const code = form.confirmationCode.trim();
    if (!code) return;

    setLookupLoading(true);
    try {
      const response = await fetch(`/api/admin/trips/${tripId}/items/flight-lookup?confirmationCode=${encodeURIComponent(code)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Nenhum voo encontrado para esse localizador.');
      }

      const payload = await response.json() as FlightLookupPayload;
      setForm((current) => ({
        ...current,
        title: payload.title || current.title,
        providerName: payload.providerName ?? current.providerName,
        startAt: payload.startAt ? toDateTimeLocal(payload.startAt) : current.startAt,
        endAt: payload.endAt ? toDateTimeLocal(payload.endAt) : current.endAt,
        location: payload.location ?? current.location,
        confirmationCode: payload.confirmationCode ?? current.confirmationCode,
        description: payload.description ?? current.description,
      }));
      toast({ title: 'Dados do voo preenchidos automaticamente', variant: 'success' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Nao foi possivel localizar o voo.',
        variant: 'error',
      });
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        title: form.title,
        providerName: form.providerName || null,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        location: form.location || null,
        confirmationCode: form.confirmationCode || null,
        description: form.description || null,
        passengerId: form.passengerId || null,
      };

      if (editingId) {
        const res = await fetch(`/api/admin/trips/${tripId}/items/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const { item } = await res.json() as { item: TripItem };
        setItems(prev => prev.map(i => i.id === editingId ? item : i));
        toast({ title: 'Item atualizado com sucesso', variant: 'success' });
      } else {
        const res = await fetch(`/api/admin/trips/${tripId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const { item } = await res.json() as { item: TripItem };
        setItems(prev => [...prev, item].sort((a, b) => {
          if (a.startAt && b.startAt) return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
          if (a.startAt) return -1;
          if (b.startAt) return 1;
          return a.sortOrder - b.sortOrder;
        }));
        toast({ title: 'Item criado com sucesso', variant: 'success' });
      }
      closeForm();
    } catch {
      toast({ title: 'Erro ao salvar item', variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/items/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setItems(prev => prev.filter(i => i.id !== deleteId));
      toast({ title: 'Item removido', variant: 'success' });
    } catch {
      toast({ title: 'Erro ao remover item', variant: 'error' });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  return (
    <div className="rounded-[28px] border border-[#d9e2d5] bg-white p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Itens da Viagem</p>
          <p className="mt-0.5 text-sm text-[#5b665d]">Voos, hotéis, transfers, passeios e mais</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173a27]"
        >
          <Plus className="h-4 w-4" />
          Adicionar item
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 rounded-[20px] border border-[#cfe1cc] bg-[#f6faf5] p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#142018]">{editingId ? 'Editar item' : 'Novo item'}</p>
            <button type="button" onClick={closeForm} className="rounded-xl p-1 text-[#7b857b] hover:bg-[#edf1ea]">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Type */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#5b665d]">Tipo *</label>
              <select
                value={form.type}
                onChange={e => setField('type', e.target.value as ItemTypeValue)}
                className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] focus:outline-none focus:ring-2 focus:ring-[#1f6b46]"
              >
                {ITEM_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#5b665d]">Título *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder="Ex: GRU → CDG - Air France AF447"
                className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] placeholder-[#aab5ab] focus:outline-none focus:ring-2 focus:ring-[#1f6b46]"
              />
            </div>

            {/* Provider */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#5b665d]">Fornecedor</label>
              <input
                type="text"
                value={form.providerName}
                onChange={e => setField('providerName', e.target.value)}
                placeholder="Ex: Air France"
                className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] placeholder-[#aab5ab] focus:outline-none focus:ring-2 focus:ring-[#1f6b46]"
              />
            </div>

            {/* Confirmation Code */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#5b665d]">Código / Localizador</label>
              <input
                type="text"
                value={form.confirmationCode}
                onChange={e => setField('confirmationCode', e.target.value)}
                onBlur={() => { void handleFlightLookup(); }}
                placeholder="Ex: XABCP1"
                className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] placeholder-[#aab5ab] focus:outline-none focus:ring-2 focus:ring-[#1f6b46]"
              />
              {form.type === 'FLIGHT' && (
                <p className="mt-1 text-[11px] text-[#7b857b]">
                  {lookupLoading
                    ? 'Buscando voo pelo localizador...'
                    : 'Ao sair do campo, o sistema tenta preencher o voo com base no cadastro operacional da viagem.'}
                </p>
              )}
            </div>

            {/* Start At */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#5b665d]">Data/Hora início</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={e => setField('startAt', e.target.value)}
                className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] focus:outline-none focus:ring-2 focus:ring-[#1f6b46]"
              />
            </div>

            {/* End At */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#5b665d]">Data/Hora fim</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={e => setField('endAt', e.target.value)}
                className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] focus:outline-none focus:ring-2 focus:ring-[#1f6b46]"
              />
            </div>

            {/* Location */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#5b665d]">Local / Endereço</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setField('location', e.target.value)}
                placeholder="Ex: 15 Rue de Bretagne, Paris 75003"
                className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] placeholder-[#aab5ab] focus:outline-none focus:ring-2 focus:ring-[#1f6b46]"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#5b665d]">Observações</label>
              <textarea
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                rows={2}
                placeholder="Informações adicionais para o passageiro"
                className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#142018] placeholder-[#aab5ab] focus:outline-none focus:ring-2 focus:ring-[#1f6b46] resize-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-2.5 text-sm font-semibold text-[#142018] transition hover:bg-[#f6f7f2]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:opacity-60"
            >
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {editingId ? 'Salvar alterações' : 'Criar item'}
            </button>
          </div>
        </form>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#f3f4f6]" />
          ))}
        </div>
      )}

      {/* Items list */}
      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-4 py-10 text-center text-sm text-[#5b665d]">
          Nenhum item cadastrado ainda. Clique em &quot;Adicionar item&quot; para começar.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => {
            const cfg = getTypeConfig(item.type);
            const startLabel = formatDate(item.startAt);
            const endLabel = formatDate(item.endAt);

            return (
              <div
                key={item.id}
                className="group relative flex items-start gap-3 rounded-2xl border border-[#edf1ea] bg-[#fbfcfa] p-4 transition hover:border-[#d9e2d5] hover:bg-white"
              >
                {/* Emoji badge */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${cfg.bg}`}>
                  {cfg.emoji}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                    <p className="text-sm font-semibold text-[#142018]">{item.title}</p>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {item.providerName && (
                      <span className="flex items-center gap-1 text-xs text-[#5b665d]">
                        <Tag className="h-3 w-3" />
                        {item.providerName}
                      </span>
                    )}
                    {startLabel && (
                      <span className="text-xs text-[#5b665d]">
                        {endLabel ? `${startLabel} → ${endLabel}` : startLabel}
                      </span>
                    )}
                    {item.location && (
                      <span className="flex items-center gap-1 text-xs text-[#5b665d]">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </span>
                    )}
                    {item.confirmationCode && (
                      <span className="rounded-lg bg-[#f3f4f6] px-2 py-0.5 text-xs font-mono font-semibold text-[#374151]">
                        {item.confirmationCode}
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="mt-1 text-xs leading-5 text-[#7b857b]">{item.description}</p>
                  )}
                </div>

                {/* Action buttons (shown on hover) */}
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="rounded-xl p-1.5 text-[#7b857b] transition hover:bg-[#f0f4ef] hover:text-[#142018]"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(item.id)}
                    className="rounded-xl p-1.5 text-[#7b857b] transition hover:bg-[#fff3f0] hover:text-[#9b3528]"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Excluir item"
        description="Esta ação não pode ser desfeita. O item será removido permanentemente da viagem."
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
