export default function PortalLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef4ed_0%,#f8f3e9_40%,#fafbf8_100%)] px-4 py-5 sm:px-5 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-64 rounded-[38px] bg-[#dfe8de] animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-[28px] bg-[#e8eee6] animate-pulse" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="h-[420px] rounded-[32px] bg-[#e8eee6] animate-pulse" />
          <div className="h-[420px] rounded-[32px] bg-[#e8eee6] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
