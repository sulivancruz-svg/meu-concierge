'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole, MessagesSquare, ShieldCheck, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);
    if (res.ok) {
      router.push('/dashboard');
    } else {
      const payload = await res.json().catch(() => null);
      setError(payload?.error || 'E-mail ou senha incorretos.');
    }
  }

  return (
    <div className="min-h-screen bg-transparent px-5 py-8 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden rounded-[36px] border border-[#d9e2d5] bg-[#173a27] px-8 py-10 text-white shadow-[0_35px_90px_rgba(13,24,18,0.22)] lg:px-10 lg:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,179,91,0.26),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <Sparkles className="h-3.5 w-3.5 text-[#f0b35b]" />
                Produto operacional
              </div>
              <div className="max-w-xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-[-0.05em] text-white lg:text-5xl">
                  Concierge do Passageiro
                </h1>
                <p className="text-base leading-7 text-white/74">
                  Plataforma para agencia de viagens operar passageiros, jornadas, documentos, alertas e atendimento inteligente em um unico ambiente.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { icon: ShieldCheck, label: 'Auth e acesso', text: 'Estrutura pronta para perfis, portal e trilhas de permissao.' },
                  { icon: MessagesSquare, label: 'WhatsApp + IA', text: 'Base de conversa, contexto de viagem e automacao assistida.' },
                  { icon: LockKeyhole, label: 'Supabase e storage', text: 'Banco, auth, storage e isolamento aplicados na fundacao do produto.' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                    <item.icon className="mb-4 h-5 w-5 text-[#f0b35b]" />
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-white/62">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-white/62">
              <span className="rounded-full border border-white/10 px-3 py-1">Area da agencia</span>
              <span className="rounded-full border border-white/10 px-3 py-1">Area do passageiro</span>
              <span className="rounded-full border border-white/10 px-3 py-1">Documentos e timeline</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-md rounded-[32px] border border-[#d9e2d5] bg-white/95 p-8 shadow-[0_35px_90px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-8 space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ecf6ea] text-[#1f6b46]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#142018]">Entrar na operacao</h2>
                <p className="mt-1 text-sm leading-6 text-[#5b665d]">
                  Acesse o ambiente administrativo da agencia para gerenciar passageiros, viagens, documentos e conversas.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#38463a]">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
                  placeholder="admin@agencia.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#38463a]">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-[#d9e2d5] bg-[#fbfcfa] px-4 py-3 text-sm text-[#142018] outline-none transition focus:border-[#1f6b46] focus:ring-4 focus:ring-[#1f6b46]/10"
                  placeholder="Digite sua senha"
                />
              </div>

              {error && (
                <p className="rounded-2xl border border-[#f1c4bc] bg-[#fff3f0] px-4 py-3 text-sm text-[#9b3528]">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27] disabled:bg-[#7ba78d]"
              >
                {loading ? 'Entrando...' : 'Entrar'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

          </div>
        </section>
      </div>
    </div>
  );
}
