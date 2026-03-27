import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}) {
  const tones = {
    neutral: 'bg-[#eef2ec] text-[#425244]',
    info: 'bg-[#e8f2ff] text-[#17406d]',
    success: 'bg-[#e9f7ee] text-[#11623a]',
    warning: 'bg-[#fff4de] text-[#8a5a00]',
    danger: 'bg-[#fdecea] text-[#8f2d22]',
  } as const;

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', tones[tone])}>
      {children}
    </span>
  );
}
