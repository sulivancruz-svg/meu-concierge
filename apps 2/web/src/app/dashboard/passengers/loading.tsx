export default function PassengersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded-full bg-[#d9e2d5]" />
        <div className="h-10 w-72 rounded-full bg-[#d9e2d5]" />
        <div className="h-4 w-[36rem] max-w-full rounded-full bg-[#edf1ea]" />
      </div>

      <div className="rounded-[28px] border border-[#d9e2d5] bg-white/95 p-6">
        <div className="mb-5 flex gap-3">
          <div className="h-12 flex-1 rounded-2xl bg-[#edf1ea]" />
          <div className="h-12 w-32 rounded-2xl bg-[#edf1ea]" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-[26px] border border-[#edf1ea] bg-[#fbfcfa] p-5">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#edf1ea]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-52 rounded-full bg-[#edf1ea]" />
                  <div className="h-4 w-80 max-w-full rounded-full bg-[#f2f5f1]" />
                </div>
                <div className="h-8 w-28 rounded-full bg-[#edf1ea]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
