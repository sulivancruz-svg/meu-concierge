'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Mail, Phone, Plus, Save, Trash2, UserRound, UsersRound } from 'lucide-react';

type CompanionInput = {
  name: string;
  relationship: string;
  dateOfBirth: string;
  notes: string;
};

type PassengerFormValues = {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  passportNumber: string;
  notes: string;
  companions: CompanionInput[];
};

const emptyCompanion = (): CompanionInput => ({
  name: '',
  relationship: '',
  dateOfBirth: '',
  notes: '',
});

export function PassengerForm({
  mode,
  initialValues,
  passengerId,
}: {
  mode: 'create' | 'edit';
  initialValues?: Partial<PassengerFormValues>;
  passengerId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PassengerFormValues>({
    name: initialValues?.name ?? '',
    phone: initialValues?.phone ?? '',
    email: initialValues?.email ?? '',
    dateOfBirth: initialValues?.dateOfBirth ?? '',
    passportNumber: initialValues?.passportNumber ?? '',
    notes: initialValues?.notes ?? '',
    companions: initialValues?.companions?.length ? initialValues.companions : [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateCompanion(index: number, key: keyof CompanionInput, value: string) {
    setForm((current) => ({
      ...current,
      companions: current.companions.map((companion, companionIndex) =>
        companionIndex === index ? { ...companion, [key]: value } : companion,
      ),
    }));
  }

  function addCompanion() {
    setForm((current) => ({
      ...current,
      companions: [...current.companions, emptyCompanion()],
    }));
  }

  function removeCompanion(index: number) {
    setForm((current) => ({
      ...current,
      companions: current.companions.filter((_, companionIndex) => companionIndex !== index),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = mode === 'create' ? '/api/admin/passengers' : `/api/admin/passengers/${passengerId}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';
    const payload = {
      ...form,
      companions: form.companions.filter((companion) => companion.name.trim().length > 0),
    };

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const nextError = await response.json().catch(() => null);
        setError(nextError?.error || 'Nao foi possivel salvar o passageiro.');
        return;
      }

      const savedPassenger = await response.json();
      const nextPassengerId = passengerId ?? savedPassenger.id;
      router.push(`/dashboard/passengers/${nextPassengerId}?saved=1`);
      router.refresh();
    } catch {
      setError('Erro de comunicacao ao salvar passageiro.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-[28px] border border-[#d9e2d5] bg-white/95 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ecf6ea] text-[#1f6b46]">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#142018]">Dados principais</h2>
            <p className="text-sm text-[#5b665d]">Cadastro elegante e objetivo para a operacao da agencia.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[#38463a]">Nome completo</span>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex: Ana Bezerra"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-[#38463a]">
              <Phone className="h-4 w-4 text-[#1f6b46]" />
              Telefone WhatsApp
            </span>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="+55 11 99999-0000"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-[#38463a]">
              <Mail className="h-4 w-4 text-[#1f6b46]" />
              E-mail
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="passageiro@exemplo.com"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-[#38463a]">
              <CalendarDays className="h-4 w-4 text-[#1f6b46]" />
              Data de nascimento
            </span>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[#38463a]">Documento</span>
            <input
              value={form.passportNumber}
              onChange={(event) => setForm((current) => ({ ...current, passportNumber: event.target.value }))}
              placeholder="Passaporte, RG ou outro identificador"
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-[#38463a]">Observacoes</span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Preferencias, alergias, contexto comercial ou qualquer nota importante."
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#d9e2d5] bg-white/95 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff4de] text-[#8a5a00]">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#142018]">Companions vinculados</h2>
              <p className="text-sm text-[#5b665d]">Cadastre acompanhantes quando a operacao precisar manter a jornada agrupada.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={addCompanion}
            className="inline-flex items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c8d6c6]"
          >
            <Plus className="h-4 w-4" />
            Adicionar companion
          </button>
        </div>

        <div className="space-y-4">
          {form.companions.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#d9e2d5] bg-[#fbfcfa] px-5 py-8 text-center text-sm text-[#5b665d]">
              Nenhum acompanhante vinculado ainda.
            </div>
          ) : form.companions.map((companion, index) => (
            <div key={`${index}-${companion.name}`} className="rounded-[24px] border border-[#edf1ea] bg-[#fbfcfa] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#142018]">Companion {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeCompanion(index)}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#8f2d22] transition hover:bg-[#fdecea]"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#38463a]">Nome completo</span>
                  <input
                    value={companion.name}
                    onChange={(event) => updateCompanion(index, 'name', event.target.value)}
                    placeholder="Nome do acompanhante"
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#38463a]">Relacao</span>
                  <input
                    value={companion.relationship}
                    onChange={(event) => updateCompanion(index, 'relationship', event.target.value)}
                    placeholder="Conjuge, filho, amigo..."
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-[#38463a]">Data de nascimento</span>
                  <input
                    type="date"
                    value={companion.dateOfBirth}
                    onChange={(event) => updateCompanion(index, 'dateOfBirth', event.target.value)}
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-[#38463a]">Observacoes</span>
                  <textarea
                    rows={3}
                    value={companion.notes}
                    onChange={(event) => updateCompanion(index, 'notes', event.target.value)}
                    placeholder="Contexto adicional deste acompanhante."
                    className="w-full rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
                  />
                </label>
              </div>
            </div>
          ))}
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
          className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:bg-[#90b39c]"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Salvando...' : mode === 'create' ? 'Salvar passageiro' : 'Atualizar passageiro'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-2xl border border-[#d9e2d5] bg-white px-5 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c8d6c6]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
