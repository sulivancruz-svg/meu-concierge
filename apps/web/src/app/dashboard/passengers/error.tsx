'use client';

export default function PassengersError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-[#f1c4bc] bg-white/95 p-8 text-center shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
      <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#142018]">Falha ao carregar passageiros</h2>
      <p className="mt-3 text-sm leading-6 text-[#5b665d]">
        O modulo de passageiros encontrou um erro inesperado. Tente novamente para recarregar a operacao.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
      >
        Tentar novamente
      </button>
    </div>
  );
}
