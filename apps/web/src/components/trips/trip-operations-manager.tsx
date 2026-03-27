'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  BusFront,
  FilePenLine,
  LoaderCircle,
  PencilLine,
  PlaneTakeoff,
  Plus,
  Save,
  ShieldCheck,
  Ticket,
  Train,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast-provider';
import { cn } from '@/lib/utils';

type PassengerOption = {
  id: string;
  name: string;
};

type SelectOption = {
  value: string;
  label: string;
};

type FieldDef<T extends Record<string, string>> = {
  name: keyof T & string;
  label: string;
  type: 'text' | 'textarea' | 'datetime-local' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
  onValueChange?: (value: string, current: T) => T;
};

type CrudItem<T extends Record<string, string>> = {
  id: string;
  values: T;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
};

type CrudSectionProps<T extends Record<string, string>> = {
  title: string;
  description: string;
  icon: LucideIcon;
  endpoint: string;
  fields: Array<FieldDef<T>>;
  items: CrudItem<T>[];
  emptyValues: T;
  normalize: (raw: Record<string, unknown>) => CrudItem<T>;
  emptyMessage: string;
  onItemsChange: (items: CrudItem<T>[]) => void;
};

type FlightFormValues = {
  airlineName: string;
  airlineCode: string;
  flightNumber: string;
  bookingReference: string;
  iataCode: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  actualDepartureAt: string;
  actualArrivalAt: string;
  terminal: string;
  gate: string;
  statusCode: string;
  passengerId: string;
};

type HotelFormValues = {
  hotelName: string;
  address: string;
  city: string;
  country: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string;
  notes: string;
  passengerId: string;
};

type TransportFormValues = {
  type: string;
  provider: string;
  departureLocation: string;
  arrivalLocation: string;
  startAt: string;
  endAt: string;
  bookingReference: string;
  notes: string;
  passengerId: string;
};

type TourFormValues = {
  title: string;
  provider: string;
  location: string;
  startAt: string;
  endAt: string;
  bookingReference: string;
  notes: string;
  passengerId: string;
};

type TrainFormValues = {
  provider: string;
  trainNumber: string;
  origin: string;
  destination: string;
  departureAt: string;
  arrivalAt: string;
  bookingReference: string;
  notes: string;
  passengerId: string;
};

type InsuranceFormValues = {
  provider: string;
  policyNumber: string;
  emergencyPhone: string;
  coverageSummary: string;
  validFrom: string;
  validUntil: string;
  notes: string;
  passengerId: string;
};

type NoteFormValues = {
  body: string;
};

type OperationsManagerProps = {
  tripId: string;
  passengers: PassengerOption[];
  flights: Array<Record<string, unknown>>;
  hotels: Array<Record<string, unknown>>;
  transports: Array<Record<string, unknown>>;
  tours: Array<Record<string, unknown>>;
  trains: Array<Record<string, unknown>>;
  insurances: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
};

const flightStatusOptions: SelectOption[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ON_TIME', label: 'On time' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'DEPARTED', label: 'Departed' },
  { value: 'LANDED', label: 'Landed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'DIVERTED', label: 'Diverted' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const airlineOptions = [
  { value: 'AD', label: 'Azul (AD)', name: 'Azul' },
  { value: 'G3', label: 'GOL (G3)', name: 'GOL' },
  { value: 'JJ', label: 'LATAM Brasil (JJ)', name: 'LATAM Brasil' },
  { value: 'LA', label: 'LATAM (LA)', name: 'LATAM' },
  { value: 'CM', label: 'Copa Airlines (CM)', name: 'Copa Airlines' },
  { value: 'AV', label: 'Avianca (AV)', name: 'Avianca' },
  { value: 'AR', label: 'Aerolineas Argentinas (AR)', name: 'Aerolineas Argentinas' },
  { value: 'AF', label: 'Air France (AF)', name: 'Air France' },
  { value: 'KL', label: 'KLM (KL)', name: 'KLM' },
  { value: 'IB', label: 'Iberia (IB)', name: 'Iberia' },
  { value: 'UX', label: 'Air Europa (UX)', name: 'Air Europa' },
  { value: 'LH', label: 'Lufthansa (LH)', name: 'Lufthansa' },
  { value: 'LX', label: 'SWISS (LX)', name: 'SWISS' },
  { value: 'TP', label: 'TAP Air Portugal (TP)', name: 'TAP Air Portugal' },
  { value: 'AZ', label: 'ITA Airways (AZ)', name: 'ITA Airways' },
  { value: 'BA', label: 'British Airways (BA)', name: 'British Airways' },
  { value: 'AA', label: 'American Airlines (AA)', name: 'American Airlines' },
  { value: 'DL', label: 'Delta Air Lines (DL)', name: 'Delta Air Lines' },
  { value: 'UA', label: 'United Airlines (UA)', name: 'United Airlines' },
  { value: 'EK', label: 'Emirates (EK)', name: 'Emirates' },
  { value: 'QR', label: 'Qatar Airways (QR)', name: 'Qatar Airways' },
  { value: 'TK', label: 'Turkish Airlines (TK)', name: 'Turkish Airlines' },
  { value: 'AC', label: 'Air Canada (AC)', name: 'Air Canada' },
  { value: 'AM', label: 'Aeromexico (AM)', name: 'Aeromexico' },
].map(({ value, label, name }) => ({ value, label, name }));

const transportTypeOptions: SelectOption[] = [
  { value: 'TRANSFER', label: 'Transfer' },
  { value: 'CAR_RENTAL', label: 'Car rental' },
  { value: 'FERRY', label: 'Ferry' },
  { value: 'BUS', label: 'Bus' },
  { value: 'OTHER', label: 'Other' },
];

function toDateTimeLocal(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatShortDate(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return format(date, "dd/MM 'as' HH:mm", { locale: ptBR });
}

function getPassengerMeta(meta?: Record<string, unknown>) {
  return {
    passengerId: typeof meta?.passengerId === 'string' ? meta.passengerId : '',
    passengerName: typeof meta?.passengerName === 'string' ? meta.passengerName : '',
  };
}

function normalizeFlight(raw: Record<string, unknown>): CrudItem<FlightFormValues> {
  const meta = (raw.structuredMetadata ?? {}) as Record<string, unknown>;
  const passenger = getPassengerMeta(meta);
  const airlineName = (raw.airlineName as string) || (raw.airline as string) || '';
  const bookingReference = typeof meta.bookingReference === 'string' ? meta.bookingReference : '';

  return {
    id: raw.id as string,
    title: `${airlineName} ${raw.flightNumber as string}`,
    subtitle: `${raw.origin as string} → ${raw.destination as string}`,
    meta: `${formatShortDate(raw.departureAt as string)} · ${passenger.passengerName || 'Sem passageiro especifico'}`,
    badge: bookingReference || ((raw.statusCode as string) || ''),
    values: {
      airlineName,
      airlineCode: (raw.airline as string) || '',
      flightNumber: (raw.flightNumber as string) || '',
      bookingReference,
      iataCode: typeof meta.iataCode === 'string' ? meta.iataCode : '',
      origin: (raw.origin as string) || '',
      destination: (raw.destination as string) || '',
      departureAt: toDateTimeLocal(raw.departureAt as string),
      arrivalAt: toDateTimeLocal(raw.arrivalAt as string),
      actualDepartureAt: toDateTimeLocal(raw.actualDepartureAt as string),
      actualArrivalAt: toDateTimeLocal(raw.actualArrivalAt as string),
      terminal: (raw.departureTerminal as string) || '',
      gate: (raw.departureGate as string) || '',
      statusCode: (raw.statusCode as string) || 'SCHEDULED',
      passengerId: passenger.passengerId,
    },
  };
}

function normalizeHotel(raw: Record<string, unknown>): CrudItem<HotelFormValues> {
  const meta = (raw.structuredMetadata ?? {}) as Record<string, unknown>;
  const passenger = getPassengerMeta(meta);

  return {
    id: raw.id as string,
    title: (raw.hotelName as string) || 'Hotel',
    subtitle: `${typeof meta.city === 'string' ? meta.city : 'Cidade nao informada'}${typeof meta.country === 'string' ? `, ${meta.country}` : ''}`,
    meta: `${formatShortDate(raw.checkIn as string)} · ${passenger.passengerName || 'Sem passageiro especifico'}`,
    badge: (raw.confirmationCode as string) || '',
    values: {
      hotelName: (raw.hotelName as string) || '',
      address: (raw.address as string) || '',
      city: typeof meta.city === 'string' ? meta.city : '',
      country: typeof meta.country === 'string' ? meta.country : '',
      checkIn: toDateTimeLocal(raw.checkIn as string),
      checkOut: toDateTimeLocal(raw.checkOut as string),
      bookingReference: (raw.confirmationCode as string) || '',
      notes: (raw.notes as string) || '',
      passengerId: passenger.passengerId,
    },
  };
}

function normalizeTransport(raw: Record<string, unknown>): CrudItem<TransportFormValues> {
  const meta = (raw.structuredMetadata ?? {}) as Record<string, unknown>;
  const passenger = getPassengerMeta(meta);
  return {
    id: raw.id as string,
    title: (raw.provider as string) || (raw.name as string) || 'Transporte',
    subtitle: `${(raw.pickupPoint as string) || 'Origem nao informada'} → ${(raw.dropoffPoint as string) || 'Destino nao informado'}`,
    meta: `${formatShortDate(raw.scheduledAt as string)} · ${passenger.passengerName || 'Sem passageiro especifico'}`,
    badge: (raw.type as string) || '',
    values: {
      type: (raw.type as string) || 'TRANSFER',
      provider: (raw.provider as string) || '',
      departureLocation: (raw.pickupPoint as string) || '',
      arrivalLocation: (raw.dropoffPoint as string) || '',
      startAt: toDateTimeLocal(raw.scheduledAt as string),
      endAt: toDateTimeLocal(raw.rentalReturnAt as string),
      bookingReference: (raw.confirmationCode as string) || '',
      notes: (raw.notes as string) || '',
      passengerId: passenger.passengerId,
    },
  };
}

function normalizeTour(raw: Record<string, unknown>): CrudItem<TourFormValues> {
  const meta = (raw.structuredMetadata ?? {}) as Record<string, unknown>;
  const passenger = getPassengerMeta(meta);
  return {
    id: raw.id as string,
    title: (raw.name as string) || 'Passeio',
    subtitle: (raw.meetingPoint as string) || 'Local nao informado',
    meta: `${formatShortDate(raw.scheduledAt as string)} · ${passenger.passengerName || 'Sem passageiro especifico'}`,
    badge: (raw.confirmationCode as string) || '',
    values: {
      title: (raw.name as string) || '',
      provider: (raw.provider as string) || '',
      location: (raw.meetingPoint as string) || '',
      startAt: toDateTimeLocal(raw.scheduledAt as string),
      endAt: toDateTimeLocal(typeof meta.endAt === 'string' ? meta.endAt : ''),
      bookingReference: (raw.confirmationCode as string) || '',
      notes: (raw.notes as string) || '',
      passengerId: passenger.passengerId,
    },
  };
}

function normalizeTrain(raw: Record<string, unknown>): CrudItem<TrainFormValues> {
  const meta = (raw.structuredMetadata ?? {}) as Record<string, unknown>;
  const passenger = getPassengerMeta(meta);
  return {
    id: raw.id as string,
    title: (raw.operator as string) || 'Trem',
    subtitle: `${(raw.origin as string) || 'Origem'} → ${(raw.destination as string) || 'Destino'}`,
    meta: `${formatShortDate(raw.departureAt as string)} · ${passenger.passengerName || 'Sem passageiro especifico'}`,
    badge: (raw.trainNumber as string) || '',
    values: {
      provider: (raw.operator as string) || '',
      trainNumber: (raw.trainNumber as string) || '',
      origin: (raw.origin as string) || '',
      destination: (raw.destination as string) || '',
      departureAt: toDateTimeLocal(raw.departureAt as string),
      arrivalAt: toDateTimeLocal(raw.arrivalAt as string),
      bookingReference: (raw.confirmationCode as string) || '',
      notes: (raw.notes as string) || '',
      passengerId: passenger.passengerId,
    },
  };
}

function normalizeInsurance(raw: Record<string, unknown>): CrudItem<InsuranceFormValues> {
  const meta = (raw.structuredMetadata ?? {}) as Record<string, unknown>;
  const passenger = getPassengerMeta(meta);
  return {
    id: raw.id as string,
    title: (raw.provider as string) || 'Seguro',
    subtitle: (raw.coverageType as string) || 'Cobertura nao informada',
    meta: `${format(new Date(raw.startDate as string), 'dd/MM/yyyy', { locale: ptBR })} ate ${format(new Date(raw.endDate as string), 'dd/MM/yyyy', { locale: ptBR })}`,
    badge: passenger.passengerName || '',
    values: {
      provider: (raw.provider as string) || '',
      policyNumber: (raw.policyNumber as string) || '',
      emergencyPhone: (raw.emergencyPhone as string) || '',
      coverageSummary: (raw.coverageType as string) || '',
      validFrom: toDateTimeLocal(raw.startDate as string),
      validUntil: toDateTimeLocal(raw.endDate as string),
      notes: (raw.notes as string) || '',
      passengerId: passenger.passengerId,
    },
  };
}

function normalizeNote(raw: Record<string, unknown>): CrudItem<NoteFormValues> {
  const author = (raw.author as Record<string, unknown> | undefined)?.name as string | undefined;
  return {
    id: raw.id as string,
    title: author || 'Equipe',
    subtitle: format(new Date(raw.createdAt as string), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR }),
    values: {
      body: (raw.body as string) || '',
    },
  };
}

function formatApiError(error: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (Array.isArray(error)) {
    const issues = error
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const message = 'message' in item && typeof item.message === 'string' ? item.message : null;
        const path = 'path' in item && Array.isArray(item.path)
          ? item.path
            .filter((value: unknown): value is string | number => typeof value === 'string' || typeof value === 'number')
            .join('.')
          : '';

        if (!message) {
          return null;
        }

        return path ? `${path}: ${message}` : message;
      })
      .filter((item): item is string => Boolean(item));

    if (issues.length) {
      return issues.join(' | ');
    }
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return fallback;
}

function CrudSection<T extends Record<string, string>>({
  title,
  description,
  icon: Icon,
  endpoint,
  fields,
  items,
  emptyValues,
  normalize,
  emptyMessage,
  onItemsChange,
}: CrudSectionProps<T>) {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();
  const [form, setForm] = useState<T>(emptyValues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function updateField(field: FieldDef<T>, value: string) {
    setForm((current) => (
      field.onValueChange
        ? field.onValueChange(value, current)
        : { ...current, [field.name]: value }
    ));
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyValues);
    setFormError('');
    setFormVisible(true);
  }

  function startEdit(item: CrudItem<T>) {
    setEditingId(item.id);
    setForm(item.values);
    setFormError('');
    setFormVisible(true);
  }

  function cancelForm() {
    setFormVisible(false);
    setEditingId(null);
    setForm(emptyValues);
    setFormError('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const url = editingId ? `${endpoint}/${editingId}` : endpoint;
    const method = editingId ? 'PATCH' : 'POST';
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const msg = formatApiError(payload?.error, 'Nao foi possivel salvar este item.');
        setFormError(msg);
        toastError('Erro ao salvar', msg);
        return;
      }
      const normalized = normalize(payload as Record<string, unknown>);
      onItemsChange(editingId ? items.map((item) => (item.id === editingId ? normalized : item)) : [...items, normalized]);
      toastSuccess(editingId ? 'Item atualizado com sucesso.' : 'Item criado com sucesso.');
      cancelForm();
      router.refresh();
    } catch {
      const msg = 'Erro de conexão ao salvar.';
      setFormError(msg);
      toastError('Erro de conexão', msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const response = await fetch(`${endpoint}/${confirmDeleteId}`, { method: 'DELETE' });
      if (!response.ok) {
        toastError('Erro ao excluir', 'Não foi possível remover este item.');
        return;
      }
      onItemsChange(items.filter((item) => item.id !== confirmDeleteId));
      toastSuccess('Item removido com sucesso.');
      router.refresh();
    } catch {
      toastError('Erro de conexão', 'Falha ao remover item.');
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  const itemToDelete = items.find((i) => i.id === confirmDeleteId);

  return (
    <>
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Excluir item"
        description={`Deseja excluir "${itemToDelete?.title ?? 'este item'}"? Esta ação não pode ser desfeita.`}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <SectionCard
        title={title}
        description={description}
        action={(
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-2.5 text-sm font-semibold text-[#142018] transition hover:border-[#c8d6c6] hover:bg-[#f6f7f2]"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        )}
      >
        <div className="space-y-3">
          {formVisible && (
            <form onSubmit={handleSubmit} className="rounded-[24px] border border-[#c8d6c6] bg-[#f8fcf9] p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1f6b46]/10 text-[#1f6b46]">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-sm font-semibold text-[#142018]">{editingId ? 'Editar item' : 'Novo item'}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {fields.map((field) => (
                  <label key={field.name} className={cn('space-y-1.5', field.type === 'textarea' && 'md:col-span-2')}>
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#7b857b]">
                      {field.label}{field.required && <span className="ml-0.5 text-[#9b3528]">*</span>}
                    </span>
                    {field.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        required={field.required}
                        value={form[field.name]}
                        onChange={(e) => updateField(field, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2.5 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-2 focus:ring-[#1f6b46]/10"
                      />
                    ) : field.type === 'select' ? (
                      <select
                        required={field.required}
                        value={form[field.name]}
                        onChange={(e) => updateField(field, e.target.value)}
                        className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2.5 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-2 focus:ring-[#1f6b46]/10"
                      >
                        <option value="">Selecionar</option>
                        {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        required={field.required}
                        value={form[field.name]}
                        onChange={(e) => updateField(field, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-xl border border-[#d9e2d5] bg-white px-3 py-2.5 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-2 focus:ring-[#1f6b46]/10"
                      />
                    )}
                  </label>
                ))}
              </div>

              {formError && (
                <p className="mt-3 rounded-xl border border-[#f1c4bc] bg-[#fff3f0] px-3 py-2.5 text-sm text-[#9b3528]">{formError}</p>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1f6b46] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:opacity-50"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar item'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="rounded-xl border border-[#d9e2d5] bg-white px-4 py-2.5 text-sm font-semibold text-[#142018] transition hover:bg-[#f6f7f2]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {items.length === 0 && !formVisible ? (
            <div className="flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f0f2ee] text-[#7b857b]">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm text-[#5b665d]">{emptyMessage}</p>
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm font-semibold text-[#142018] transition hover:bg-[#f6f7f2]"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar primeiro
              </button>
            </div>
          ) : items.map((item) => (
            <div key={item.id} className="group flex items-start gap-3 rounded-[20px] border border-[#edf1ea] bg-white px-4 py-3.5 transition hover:border-[#d9e2d5]">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#142018]">{item.title}</p>
                  {item.badge && <StatusBadge tone="info">{item.badge}</StatusBadge>}
                </div>
                {item.subtitle && <p className="mt-0.5 text-sm text-[#5b665d]">{item.subtitle}</p>}
                {item.meta && <p className="mt-1 text-xs text-[#7b857b]">{item.meta}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  title="Editar"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5b665d] transition hover:bg-[#f0f2ee] hover:text-[#142018]"
                >
                  <PencilLine className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(item.id)}
                  title="Excluir"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c8958a] transition hover:bg-[#fff3f0] hover:text-[#9b3528]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

export function TripOperationsManager({
  tripId,
  passengers,
  flights,
  hotels,
  transports,
  tours,
  trains,
  insurances,
  notes,
}: OperationsManagerProps) {
  const passengerOptions = [
    { value: '', label: 'Nenhum passageiro especifico' },
    ...passengers.map((passenger) => ({ value: passenger.id, label: passenger.name })),
  ];

  const [flightItems, setFlightItems] = useState(flights.map(normalizeFlight));
  const [hotelItems, setHotelItems] = useState(hotels.map(normalizeHotel));
  const [transportItems, setTransportItems] = useState(transports.map(normalizeTransport));
  const [tourItems, setTourItems] = useState(tours.map(normalizeTour));
  const [trainItems, setTrainItems] = useState(trains.map(normalizeTrain));
  const [insuranceItems, setInsuranceItems] = useState(insurances.map(normalizeInsurance));
  const [noteItems, setNoteItems] = useState(notes.map(normalizeNote));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <CrudSection
        title="Voos"
        description="CRUD operacional de trechos aereos com status, horario real e passageiro opcional."
        icon={PlaneTakeoff}
        endpoint={`/api/admin/trips/${tripId}/flights`}
        items={flightItems}
        onItemsChange={setFlightItems}
        emptyValues={{ airlineName: '', airlineCode: '', flightNumber: '', bookingReference: '', iataCode: '', origin: '', destination: '', departureAt: '', arrivalAt: '', actualDepartureAt: '', actualArrivalAt: '', terminal: '', gate: '', statusCode: 'SCHEDULED', passengerId: '' }}
        normalize={normalizeFlight}
        emptyMessage="Nenhum voo cadastrado."
        fields={[
          { name: 'airlineName', label: 'Companhia', type: 'text', required: true },
          {
            name: 'airlineCode',
            label: 'Codigo da companhia',
            type: 'select',
            required: true,
            options: airlineOptions.map((option) => ({ value: option.value, label: option.label })),
            onValueChange: (value, current) => {
              const selected = airlineOptions.find((option) => option.value === value);
              return {
                ...current,
                airlineCode: value,
                airlineName: selected?.name ?? current.airlineName,
              };
            },
          },
          { name: 'flightNumber', label: 'Numero do voo', type: 'text', required: true },
          { name: 'bookingReference', label: 'Localizador', type: 'text' },
          { name: 'iataCode', label: 'Codigo IATA', type: 'text' },
          { name: 'origin', label: 'Aeroporto de saida', type: 'text', required: true },
          { name: 'destination', label: 'Aeroporto de chegada', type: 'text', required: true },
          { name: 'departureAt', label: 'Saida prevista', type: 'datetime-local', required: true },
          { name: 'arrivalAt', label: 'Chegada prevista', type: 'datetime-local', required: true },
          { name: 'actualDepartureAt', label: 'Saida real', type: 'datetime-local' },
          { name: 'actualArrivalAt', label: 'Chegada real', type: 'datetime-local' },
          { name: 'terminal', label: 'Terminal', type: 'text' },
          { name: 'gate', label: 'Portao', type: 'text' },
          { name: 'statusCode', label: 'Status', type: 'select', options: flightStatusOptions },
          { name: 'passengerId', label: 'Passageiro', type: 'select', options: passengerOptions },
        ]}
      />

      <CrudSection
        title="Hoteis"
        description="Hospedagem com booking reference, geografia e passageiro opcional."
        icon={BedDouble}
        endpoint={`/api/admin/trips/${tripId}/hotels`}
        items={hotelItems}
        onItemsChange={setHotelItems}
        emptyValues={{ hotelName: '', address: '', city: '', country: '', checkIn: '', checkOut: '', bookingReference: '', notes: '', passengerId: '' }}
        normalize={normalizeHotel}
        emptyMessage="Nenhum hotel cadastrado."
        fields={[
          { name: 'hotelName', label: 'Nome do hotel', type: 'text', required: true },
          { name: 'address', label: 'Endereco', type: 'text' },
          { name: 'city', label: 'Cidade', type: 'text' },
          { name: 'country', label: 'Pais', type: 'text' },
          { name: 'checkIn', label: 'Check-in', type: 'datetime-local', required: true },
          { name: 'checkOut', label: 'Check-out', type: 'datetime-local', required: true },
          { name: 'bookingReference', label: 'Booking reference', type: 'text' },
          { name: 'passengerId', label: 'Passageiro', type: 'select', options: passengerOptions },
          { name: 'notes', label: 'Observacoes', type: 'textarea' },
        ]}
      />

      <CrudSection
        title="Transportes"
        description="Transfers e deslocamentos com inicio, fim e referencia de reserva."
        icon={BusFront}
        endpoint={`/api/admin/trips/${tripId}/transports`}
        items={transportItems}
        onItemsChange={setTransportItems}
        emptyValues={{ type: 'TRANSFER', provider: '', departureLocation: '', arrivalLocation: '', startAt: '', endAt: '', bookingReference: '', notes: '', passengerId: '' }}
        normalize={normalizeTransport}
        emptyMessage="Nenhum transporte cadastrado."
        fields={[
          { name: 'type', label: 'Tipo', type: 'select', options: transportTypeOptions, required: true },
          { name: 'provider', label: 'Fornecedor', type: 'text' },
          { name: 'departureLocation', label: 'Local de saida', type: 'text', required: true },
          { name: 'arrivalLocation', label: 'Local de chegada', type: 'text', required: true },
          { name: 'startAt', label: 'Inicio', type: 'datetime-local', required: true },
          { name: 'endAt', label: 'Fim', type: 'datetime-local' },
          { name: 'bookingReference', label: 'Booking reference', type: 'text' },
          { name: 'passengerId', label: 'Passageiro', type: 'select', options: passengerOptions },
          { name: 'notes', label: 'Observacoes', type: 'textarea' },
        ]}
      />

      <CrudSection
        title="Passeios"
        description="Atividades e tours com fornecedor, local e observacoes."
        icon={Ticket}
        endpoint={`/api/admin/trips/${tripId}/tours`}
        items={tourItems}
        onItemsChange={setTourItems}
        emptyValues={{ title: '', provider: '', location: '', startAt: '', endAt: '', bookingReference: '', notes: '', passengerId: '' }}
        normalize={normalizeTour}
        emptyMessage="Nenhum passeio cadastrado."
        fields={[
          { name: 'title', label: 'Titulo', type: 'text', required: true },
          { name: 'provider', label: 'Fornecedor', type: 'text' },
          { name: 'location', label: 'Local', type: 'text' },
          { name: 'startAt', label: 'Inicio', type: 'datetime-local', required: true },
          { name: 'endAt', label: 'Fim', type: 'datetime-local' },
          { name: 'bookingReference', label: 'Booking reference', type: 'text' },
          { name: 'passengerId', label: 'Passageiro', type: 'select', options: passengerOptions },
          { name: 'notes', label: 'Observacoes', type: 'textarea' },
        ]}
      />

      <CrudSection
        title="Trens"
        description="Trechos ferroviarios com horarios, referencia e passageiro opcional."
        icon={Train}
        endpoint={`/api/admin/trips/${tripId}/trains`}
        items={trainItems}
        onItemsChange={setTrainItems}
        emptyValues={{ provider: '', trainNumber: '', origin: '', destination: '', departureAt: '', arrivalAt: '', bookingReference: '', notes: '', passengerId: '' }}
        normalize={normalizeTrain}
        emptyMessage="Nenhum trem cadastrado."
        fields={[
          { name: 'provider', label: 'Fornecedor', type: 'text', required: true },
          { name: 'trainNumber', label: 'Numero do trem', type: 'text' },
          { name: 'origin', label: 'Estacao de saida', type: 'text', required: true },
          { name: 'destination', label: 'Estacao de chegada', type: 'text', required: true },
          { name: 'departureAt', label: 'Horario de saida', type: 'datetime-local', required: true },
          { name: 'arrivalAt', label: 'Horario de chegada', type: 'datetime-local', required: true },
          { name: 'bookingReference', label: 'Booking reference', type: 'text' },
          { name: 'passengerId', label: 'Passageiro', type: 'select', options: passengerOptions },
          { name: 'notes', label: 'Observacoes', type: 'textarea' },
        ]}
      />

      <CrudSection
        title="Seguros"
        description="Apolices com vigencia, emergencia e resumo de cobertura."
        icon={ShieldCheck}
        endpoint={`/api/admin/trips/${tripId}/insurances`}
        items={insuranceItems}
        onItemsChange={setInsuranceItems}
        emptyValues={{ provider: '', policyNumber: '', emergencyPhone: '', coverageSummary: '', validFrom: '', validUntil: '', notes: '', passengerId: '' }}
        normalize={normalizeInsurance}
        emptyMessage="Nenhum seguro cadastrado."
        fields={[
          { name: 'provider', label: 'Seguradora', type: 'text', required: true },
          { name: 'policyNumber', label: 'Numero da apolice', type: 'text' },
          { name: 'emergencyPhone', label: 'Contato de emergencia', type: 'text' },
          { name: 'coverageSummary', label: 'Resumo de cobertura', type: 'text' },
          { name: 'validFrom', label: 'Validade inicial', type: 'datetime-local', required: true },
          { name: 'validUntil', label: 'Validade final', type: 'datetime-local', required: true },
          { name: 'passengerId', label: 'Passageiro', type: 'select', options: passengerOptions },
          { name: 'notes', label: 'Observacoes', type: 'textarea' },
        ]}
      />

      <CrudSection
        title="Observacoes internas"
        description="Notas editaveis da equipe com autor e data preservados."
        icon={FilePenLine}
        endpoint={`/api/admin/trips/${tripId}/notes`}
        items={noteItems}
        onItemsChange={setNoteItems}
        emptyValues={{ body: '' }}
        normalize={normalizeNote}
        emptyMessage="Nenhuma observacao interna registrada."
        fields={[
          { name: 'body', label: 'Observacao', type: 'textarea', required: true, placeholder: 'Contexto interno, alinhamentos e pontos de atencao.' },
        ]}
      />
    </div>
  );
}

