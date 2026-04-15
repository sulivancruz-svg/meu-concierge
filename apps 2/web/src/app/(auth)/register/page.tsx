'use client';

import { Building2, LockKeyhole, UserRound } from 'lucide-react';
import { RegisterAgencyForm } from '@/components/auth/register-agency-form';

export default function RegisterAgencyPage() {
  return (
    <div className="min-h-screen bg-transparent px-5 py-8 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative overflow-hidden rounded-[36px] border border-[#d9e2d5] bg-[#173a27] px-8 py-10 text-white shadow-[0_35px_90px_rgba(13,24,18,0.22)] lg:px-10 lg:py-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,179,91,0.26),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                <Building2 className="h-3.5 w-3.5 text-[#f0b35b]" />
                Nova agencia
              </div>
              <div className="max-w-xl space-y-4">
                <h1 className="text-4xl font-semibold tracking-[-0.05em] text-white lg:text-5xl">
                  Crie sua operacao isolada
                </h1>
                <p className="text-base leading-7 text-white/74">
                  Cada nova agencia ganha ambiente proprio, owner inicial, usuarios separados e dados filtrados por `agencyId`.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { icon: Building2, label: 'Agencia propria', text: 'Base de passageiros, viagens, documentos e conversas separada das demais contas.' },
                  { icon: UserRound, label: 'Owner inicial', text: 'O primeiro usuario entra como owner e passa a administrar a propria equipe.' },
                  { icon: LockKeyhole, label: 'Supabase isolado', text: 'Auth, banco e storage continuam na mesma plataforma, mas com isolamento logico por agencia.' },
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
              <span className="rounded-full border border-white/10 px-3 py-1">Owner inicial</span>
              <span className="rounded-full border border-white/10 px-3 py-1">Area exclusiva</span>
              <span className="rounded-full border border-white/10 px-3 py-1">Equipe por agencia</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <RegisterAgencyForm mode="self_serve" />
        </section>
      </div>
    </div>
  );
}
