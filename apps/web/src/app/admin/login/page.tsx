'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (res.ok) {
      router.push('/admin');
    } else {
      const payload = await res.json().catch(() => null);
      setError(payload?.error || 'Credenciais invalidas.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1a14] px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0b35b] text-base font-bold text-[#0f1a14]">
            CP
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-white">Acesso da plataforma</h1>
          <p className="mt-1.5 text-sm text-white/50">Area restrita ao administrador do sistema.</p>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-white/5 p-7 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 transition focus:border-[#f0b35b]/50 focus:ring-2 focus:ring-[#f0b35b]/10"
                placeholder="admin@sistema.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 transition focus:border-[#f0b35b]/50 focus:ring-2 focus:ring-[#f0b35b]/10"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#f0b35b] px-4 py-3 text-sm font-semibold text-[#0f1a14] transition hover:bg-[#e8a84a] disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/25">
          Concierge do Passageiro &mdash; Plataforma
        </p>
      </div>
    </div>
  );
}
