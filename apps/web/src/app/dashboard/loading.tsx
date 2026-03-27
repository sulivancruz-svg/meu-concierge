export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-20 rounded-[28px] bg-[#eef2ec] animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-36 rounded-[24px] bg-[#eef2ec] animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="h-[360px] rounded-[28px] bg-[#eef2ec] animate-pulse" />
        <div className="h-[360px] rounded-[28px] bg-[#eef2ec] animate-pulse" />
      </div>
    </div>
  );
}
