import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'default',
}: {
  title: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: 'default' | 'accent' | 'warn' | 'danger';
}) {
  const tones = {
    default: 'bg-white border-[#d9e2d5] text-[#163020]',
    accent: 'bg-[#ecf6ea] border-[#cfe1cc] text-[#163020]',
    warn: 'bg-[#fff5df] border-[#ead7a3] text-[#5b4200]',
    danger: 'bg-[#fff1ee] border-[#e5c1b7] text-[#67291d]',
  } as const;

  return (
    <div className={cn('rounded-[24px] border p-5 shadow-[0_20px_60px_rgba(16,24,40,0.05)]', tones[tone])}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#748176]">{title}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-semibold tracking-[-0.05em]">{value}</p>
      {detail && <p className="mt-2 text-sm text-[#5b665d]">{detail}</p>}
    </div>
  );
}

