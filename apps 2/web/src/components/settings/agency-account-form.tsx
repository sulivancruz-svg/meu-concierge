'use client';

import { useRouter } from 'next/navigation';
import { LoaderCircle, Save } from 'lucide-react';
import { useState } from 'react';
import { SectionCard } from '@/components/ui/section-card';

type Props = {
  initialAgency: {
    name: string;
    slug: string;
    supportEmail: string | null;
    supportPhone: string | null;
    supportWhatsApp: string | null;
    status: string;
    plan: string;
  };
};

function slugifyAgencyName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agencia';
}

export function AgencyAccountForm({ initialAgency }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState({
    name: initialAgency.name,
    slug: initialAgency.slug,
    supportEmail: initialAgency.supportEmail ?? '',
    supportPhone: initialAgency.supportPhone ?? '',
    supportWhatsApp: initialAgency.supportWhatsApp ?? '',
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/agency', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const apiError = typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.formErrors?.[0] || 'Nao foi possivel atualizar a agencia.';
        setError(apiError);
        return;
      }

      setSuccess('Conta da agencia atualizada com sucesso.');
      router.refresh();
    } catch {
      setError('Erro de comunicacao ao atualizar a agencia.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title="Conta da agencia" description="Dados principais da instancia atual, editaveis pelo owner/admin.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {(error || success) && (
          <div className={error
            ? 'rounded-2xl border border-[#f1c4bc] bg-[#fff3f0] px-4 py-3 text-sm text-[#9b3528]'
            : 'rounded-2xl border border-[#cfe1cc] bg-[#ecf6ea] px-4 py-3 text-sm text-[#163020]'}
          >
            {error || success}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[#38463a]">Nome</span>
            <input
              required
              value={form.name}
              onChange={(event) => {
                const nextName = event.target.value;
                setForm((current) => ({
                  ...current,
                  name: nextName,
                  slug: slugTouched ? current.slug : slugifyAgencyName(nextName),
                }));
              }}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[#38463a]">Slug</span>
            <input
              required
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((current) => ({ ...current, slug: slugifyAgencyName(event.target.value) }));
              }}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018]"
            />
            <p className="text-xs text-[#7b857b]">Gerado automaticamente a partir do nome, mas ainda pode ser ajustado.</p>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[#38463a]">Email de suporte</span>
            <input
              type="email"
              value={form.supportEmail}
              onChange={(event) => setForm((current) => ({ ...current, supportEmail: event.target.value }))}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[#38463a]">Telefone</span>
            <input
              value={form.supportPhone}
              onChange={(event) => setForm((current) => ({ ...current, supportPhone: event.target.value }))}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018]"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[#38463a]">WhatsApp de suporte</span>
            <input
              value={form.supportWhatsApp}
              onChange={(event) => setForm((current) => ({ ...current, supportWhatsApp: event.target.value }))}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018]"
            />
          </label>

          <div className="rounded-2xl bg-[#f6f7f2] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b857b]">Plano e status</p>
            <p className="mt-2 text-sm font-medium text-[#142018]">{initialAgency.plan} · {initialAgency.status}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white disabled:bg-[#7ba78d]"
        >
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : 'Salvar conta da agencia'}
        </button>
      </form>
    </SectionCard>
  );
}
