export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f7f2] px-6">
      <div className="w-full max-w-xl rounded-[32px] border border-[#d9e2d5] bg-white p-8 shadow-[0_35px_90px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7b857b]">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#142018]">
          Esta pagina nao foi encontrada.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5b665d]">
          Verifique a URL ou volte para a entrada principal do Concierge do Passageiro.
        </p>
        <div className="mt-8">
          <a
            href="/login"
            className="inline-flex rounded-2xl bg-[#1f6b46] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173a27]"
          >
            Abrir login
          </a>
        </div>
      </div>
    </div>
  );
}
