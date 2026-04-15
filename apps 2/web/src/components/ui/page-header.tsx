import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7c867b]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#142018]">{title}</h1>
        {description && (
          <p className="max-w-2xl text-sm leading-6 text-[#5b665d]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

