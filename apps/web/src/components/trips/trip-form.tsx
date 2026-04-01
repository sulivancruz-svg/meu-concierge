'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarRange,
  CheckCircle2,
  Hash,
  LoaderCircle,
  MapPin,
  MessageSquareShare,
  PlaneTakeoff,
  Save,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import { TRIP_STATUS_OPTIONS } from '@/modules/trips/trip-meta';

type PassengerOption = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type TripFormValues = {
  title: string;
  internalCode: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string;
  activeForWhatsApp: boolean;
  passengerIds: string[];
};

export function TripForm({
  mode,
  tripId,
  initialValues,
  defaultPassengerId,
}: {
  mode: 'create' | 'edit';
  tripId?: string;
  initialValues?: Partial<TripFormValues>;
  defaultPassengerId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<TripFormValues>({
    title: initialValues?.title ?? '',
    internalCode: initialValues?.internalCode ?? '',
    destination: initialValues?.destination ?? '',
    startDate: initialValues?.startDate ?? '',
    endDate: initialValues?.endDate ?? '',
    status: initialValues?.status ?? 'DRAFT',
    notes: initialValues?.notes ?? '',
    activeForWhatsApp: initialValues?.activeForWhatsApp ?? false,
    passengerIds: initialValues?.passengerIds ?? (defaultPassengerId ? [defaultPassengerId] : []),
  });
  const [passengers, setPassengers] = useState<PassengerOption[]>([]);
  const [passengersLoading, setPassengersLoading] = useState(true);
  const [passengersError, setPassengersError] = useState('');
  const [passengerSearch, setPassengerSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadPassengers() {
      setPassengersLoading(true);
      setPassengersError('');

      try {
        const response = await fetch('/api/admin/passengers?limit=100', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || 'Nao foi possivel carregar passageiros.');
        }

        if (!active) {
          return;
        }

        setPassengers(payload?.items ?? []);
      } catch (nextError) {
        if (!active) {
          return;
        }

        setPassengersError(nextError instanceof Error ? nextError.message : 'Nao foi possivel carregar passageiros.');
      } finally {
        if (active) {
          setPassengersLoading(false);
        }
      }
    }

    loadPassengers();

    return () => {
      active = false;
    };
  }, []);

  function togglePassenger(passengerId: string) {
    setForm((current) => ({
      ...current,
      passengerIds: current.passengerIds.includes(passengerId)
        ? current.passengerIds.filter((id) => id !== passengerId)
        : [...current.passengerIds, passengerId],
    }));
  }

  const visiblePassengers = passengers.filter((passenger) => {
    if (!passengerSearch.trim()) {
      return true;
    }

    const query = passengerSearch.toLowerCase();
    return (
      passenger.name.toLowerCase().includes(query) ||
      passenger.email?.toLowerCase().includes(query) ||
      passenger.phone?.toLowerCase().includes(query)
    );
  });

  const selectedPassengers = form.passengerIds
    .map((id) => passengers.find((passenger) => passenger.id === id))
    .filter((passenger): passenger is PassengerOption => Boolean(passenger));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = mode === 'create' ? '/api/admin/trips' : `/api/admin/trips/${tripId}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const passengerIds = defaultPassengerId
      ? Array.from(new Set([defaultPassengerId, ...form.passengerIds]))
      : form.passengerIds;

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          passengerIds,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error || 'Nao foi possivel salvar a viagem.');
        return;
      }

      const nextTripId = tripId ?? payload.id;
      const marker = mode === 'create' ? 'saved=1' : 'updated=1';
      const destination = mode === 'create' && defaultPassengerId
        ? `/dashboard/passengers/${defaultPassengerId}?${marker}`
        : `/dashboard/trips/${nextTripId}?${marker}`;
      router.push(destination);
      router.refresh();
    } catch {
      setError('Erro de comunicacao ao salvar viagem.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-[28px] border border-[#d9e2d5] bg-white/95 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ecf6ea] text-[#1f6b46]">
            <PlaneTakeoff className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#142018]">Dados principais da viagem</h2>
            <p className="text-sm text-[#5b665d]">Titulo, codigo, periodo, status e sinalizacao operacional para WhatsApp.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[#38463a]">Titulo da viagem</span>
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ex: Italia Essencial - Familia Bezerra"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-[#38463a]">
              <Hash className="h-4 w-4 text-[#1f6b46]" />
              Codigo interno
            </span>
            <input
              value={form.internalCode}
              onChange={(event) => setForm((current) => ({ ...current, internalCode: event.target.value }))}
              placeholder="TRIP-2026-014"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-[#38463a]">
              <MapPin className="h-4 w-4 text-[#1f6b46]" />
              Destino principal
            </span>
            <input
              value={form.destination}
              onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
              placeholder="Roma, Florenca e Veneza"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-[#38463a]">
              <CalendarRange className="h-4 w-4 text-[#1f6b46]" />
              Data de inicio
            </span>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-[#38463a]">
              <CalendarRange className="h-4 w-4 text-[#1f6b46]" />
              Data de fim
            </span>
            <input
              type="date"
              required
              value={form.endDate}
              onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[#38463a]">Status da viagem</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            >
              {TRIP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[#38463a]">Observacoes</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Contexto comercial, checkpoints de operacao, preferencias do grupo e observacoes relevantes."
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>
        </div>

        <div className="mt-5 rounded-[24px] border border-[#d9e2d5] bg-[#f8fbf6] p-4">
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <div>
              <span className="flex items-center gap-2 text-sm font-semibold text-[#142018]">
                <MessageSquareShare className="h-4 w-4 text-[#1f6b46]" />
                Viagem ativa para WhatsApp
              </span>
              <p className="mt-1 text-sm leading-6 text-[#5b665d]">
                Marque esta opcao quando a viagem puder ser usada pelo atendimento no WhatsApp. Essa escolha nao desativa automaticamente as outras viagens.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.activeForWhatsApp}
              onChange={(event) => setForm((current) => ({ ...current, activeForWhatsApp: event.target.checked }))}
              className="mt-1 h-5 w-5 rounded border-[#c6d5c3] text-[#1f6b46] focus:ring-[#1f6b46]"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#d9e2d5] bg-white/95 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff4de] text-[#8a5a00]">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#142018]">Passageiros vinculados</h2>
              <p className="text-sm text-[#5b665d]">Monte o grupo da viagem e deixe o primeiro selecionado como titular operacional.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#5b665d]">
            {selectedPassengers.length} passageiro{selectedPassengers.length === 1 ? '' : 's'} selecionado{selectedPassengers.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b857b]" />
              <input
                value={passengerSearch}
                onChange={(event) => setPassengerSearch(event.target.value)}
                placeholder="Buscar por nome, telefone ou e-mail"
                className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] py-3 pl-11 pr-4 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
              />
            </label>

            <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-[24px] border border-[#d9e2d5] bg-[#fbfcfa] p-3">
              {passengersLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl px-4 py-10 text-sm text-[#5b665d]">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Carregando passageiros...
                </div>
              ) : passengersError ? (
                <div className="rounded-2xl border border-[#f1c4bc] bg-[#fff3f0] px-4 py-4 text-sm text-[#9b3528]">
                  {passengersError}
                </div>
              ) : visiblePassengers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d9e2d5] bg-white px-4 py-10 text-center text-sm text-[#5b665d]">
                  Nenhum passageiro encontrado para este filtro.
                </div>
              ) : visiblePassengers.map((passenger) => {
                const selected = form.passengerIds.includes(passenger.id);

                return (
                  <button
                    key={passenger.id}
                    type="button"
                    onClick={() => togglePassenger(passenger.id)}
                    className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${
                      selected
                        ? 'border-[#1f6b46] bg-[#ecf6ea]'
                        : 'border-[#d9e2d5] bg-white hover:border-[#c7d7c4]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#142018]">{passenger.name}</p>
                        <p className="mt-1 text-sm text-[#5b665d]">{passenger.phone || passenger.email || 'Sem contato principal'}</p>
                      </div>
                      {selected && <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#1f6b46]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#d9e2d5] bg-white p-4">
            <p className="text-sm font-semibold text-[#142018]">Grupo selecionado</p>
            <p className="mt-1 text-sm text-[#5b665d]">O primeiro item funciona como titular operacional da viagem.</p>

            <div className="mt-4 space-y-3">
              {selectedPassengers.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-4 py-10 text-center text-sm text-[#5b665d]">
                  Nenhum passageiro vinculado ainda.
                </div>
              ) : selectedPassengers.map((passenger, index) => (
                <div key={passenger.id} className="flex items-start justify-between gap-3 rounded-[20px] border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#142018]">{passenger.name}</p>
                      {index === 0 && (
                        <span className="rounded-full bg-[#e8f2ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#17406d]">
                          Titular
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[#5b665d]">{passenger.phone || passenger.email || 'Sem contato principal'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePassenger(passenger.id)}
                    className="rounded-full p-1.5 text-[#7b857b] transition hover:bg-white hover:text-[#142018]"
                    aria-label={`Remover ${passenger.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-[#f1c4bc] bg-[#fff3f0] px-4 py-4 text-sm text-[#9b3528]">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:bg-[#7ba78d]"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {loading ? 'Salvando viagem...' : mode === 'create' ? 'Criar viagem' : 'Salvar alteracoes'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c8d6c6]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
