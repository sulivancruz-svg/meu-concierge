'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="pt-BR">
      <body className="bg-[#f5f7f2]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-xl rounded-[32px] border border-[#d9e2d5] bg-white p-8 shadow-[0_35px_90px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b857b]">Falha global</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#142018]">
              O app encontrou um erro inesperado.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#5b665d]">
              Isso evita a tela em branco e permite recuperar a interface sem recarregar manualmente.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
              >
                Recarregar app
              </button>
              <a
                href="/login"
                className="rounded-2xl border border-[#d9e2d5] bg-white px-4 py-3 text-sm font-semibold text-[#142018] transition hover:border-[#c3d1c1]"
              >
                Ir para login
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
