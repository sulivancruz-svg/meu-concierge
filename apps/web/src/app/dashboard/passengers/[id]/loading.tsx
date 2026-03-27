export default function PassengerDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-[#d9e2d5]" />
        <div className="h-10 w-80 rounded-full bg-[#d9e2d5]" />
        <div className="h-4 w-[30rem] max-w-full rounded-full bg-[#edf1ea]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 rounded-[28px] border border-[#d9e2d5] bg-white/95" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-72 rounded-[28px] border border-[#d9e2d5] bg-white/95" />
        ))}
      </div>
    </div>
  );
}
