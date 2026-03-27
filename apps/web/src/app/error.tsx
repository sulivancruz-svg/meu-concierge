'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7f2] px-6">
      <div className="w-full max-w-xl rounded-[32px] border border-[#d9e2d5] bg-white p-8 shadow-[0_35px_90px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b857b]">Erro de aplicacao</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#142018]">
          Nao foi possivel carregar esta tela.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5b665d]">
          O ambiente tentou se recuperar, mas ainda houve uma falha durante a renderizacao.
        </p>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
          >
            Tentar novamente
          </button>
          <a
            href="/login"
            className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c3d1c1]"
          >
            Voltar ao login
          </a>
        </div>
      </div>
    </div>
  );
}
