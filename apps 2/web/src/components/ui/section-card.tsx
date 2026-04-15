import type { ReactNode } from 'react';

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#d9e2d5] bg-white/95 p-6 shadow-[0_24px_70px_rgba(16,24,40,0.05)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#142018]">{title}</h2>
          {description && <p className="text-sm leading-6 text-[#5b665d]">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

