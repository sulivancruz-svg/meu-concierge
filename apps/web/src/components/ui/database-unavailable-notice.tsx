type DatabaseUnavailableNoticeProps = {
  context?: string;
};

export function DatabaseUnavailableNotice({
  context = 'Os dados mais recentes nao puderam ser carregados.',
}: DatabaseUnavailableNoticeProps) {
  return (
    <div className="rounded-[24px] border border-[#efc8c1] bg-[#fff5f3] px-5 py-4 text-sm text-[#8a3025]">
      Banco indisponivel no momento. {context}
    </div>
  );
}
