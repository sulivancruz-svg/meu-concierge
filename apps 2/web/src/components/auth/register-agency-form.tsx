'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, Copy } from 'lucide-react';
import { useState } from 'react';

type Props = {
  compact?: boolean;
  mode?: 'self_serve' | 'invite';
};

export function RegisterAgencyForm({ compact = false, mode = 'self_serve' }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    agencyName: '',
    ownerName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<null | { ownerEmail: string; inviteLink?: string }>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(null);
    setCopied(false);

    const response = await fetch('/api/auth/register-agency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        mode,
      }),
    });

    const payload = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok) {
      setError(
        typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.formErrors?.[0] || 'Nao foi possivel criar a agencia.',
      );
      return;
    }

    if (mode === 'self_serve') {
      router.push(payload?.redirectTo || '/dashboard');
      router.refresh();
      return;
    }

    setSuccess({
      ownerEmail: payload?.ownerEmail || form.email,
      inviteLink: payload?.inviteLink,
    });
    setForm({
      agencyName: '',
      ownerName: '',
      email: '',
      password: '',
    });
  }

  async function handleCopyInviteLink() {
    if (!success?.inviteLink) {
      return;
    }

    await navigator.clipboard.writeText(success.inviteLink);
    setCopied(true);
  }

  return (
    <div className={`w-full ${compact ? 'max-w-2xl' : 'max-w-lg'} rounded-[32px] border border-[#d9e2d5] bg-white/95 p-8 shadow-[0_35px_90px_rgba(15,23,42,0.08)] backdrop-blur`}>
      <div className="mb-8 space-y-3">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ecf6ea] text-[#1f6b46]">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#142018]">Criar nova agencia</h2>
          <p className="mt-1 text-sm leading-6 text-[#5b665d]">
            {mode === 'self_serve'
              ? 'Cadastro inicial do SaaS com agencia propria e usuario owner.'
              : 'Crie a agencia e gere o convite de acesso para o owner por e-mail.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#38463a]">Nome da agencia</label>
          <input
            required
            value={form.agencyName}
            onChange={(event) => setForm((current) => ({ ...current, agencyName: event.target.value }))}
            className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            placeholder="Ex: Atlas Concierge"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#38463a]">Nome do owner</label>
          <input
            required
            value={form.ownerName}
            onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))}
            className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            placeholder="Ex: Helena Costa"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#38463a]">E-mail do owner</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
            placeholder="owner@agencia.com"
          />
        </div>
        {mode === 'self_serve' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#38463a]">Senha inicial</label>
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
              placeholder="Minimo de 8 caracteres"
            />
          </div>
        )}

        {error && (
          <p className="rounded-2xl border border-[#f1c4bc] bg-[#fff3f0] px-4 py-3 text-sm text-[#9b3528]">{error}</p>
        )}

        {success && (
          <div className="rounded-2xl border border-[#cfe1cc] bg-[#ecf6ea] p-4 text-sm text-[#163020]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-3">
                <p className="font-semibold">Agencia criada com sucesso.</p>
                <p>Owner cadastrado: {success.ownerEmail}</p>
                {success.inviteLink && (
                  <>
                    <p className="break-all rounded-xl border border-[#cfe1cc] bg-white px-3 py-2 text-xs text-[#38463a]">
                      {success.inviteLink}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyInviteLink}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#cfe1cc] bg-white px-3 py-2 text-sm font-semibold text-[#1f6b46]"
                    >
                      <Copy className="h-4 w-4" />
                      {copied ? 'Link copiado' : 'Copiar link de convite'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:bg-[#7ba78d]"
        >
          {loading ? 'Criando agencia...' : mode === 'self_serve' ? 'Criar agencia' : 'Criar e gerar convite'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      {!compact && (
        <div className="mt-6 text-sm text-[#5b665d]">
          Ja tem acesso?{' '}
          <Link href="/login" className="font-semibold text-[#1f6b46]">
            Entrar na operacao
          </Link>
        </div>
      )}
    </div>
  );
}
