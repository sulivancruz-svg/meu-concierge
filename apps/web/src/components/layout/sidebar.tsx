'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { adminNavigation } from '@/modules/navigation/admin';

interface SidebarProps {
  isPlatformOwner?: boolean;
}

export default function Sidebar({ isPlatformOwner = false }: SidebarProps) {
  const pathname = usePathname();
  const groups = [
    { key: 'operacao', label: 'Hub Principal' },
    { key: 'atendimento', label: 'Experiencia' },
    { key: 'plataforma', label: 'Plataforma' },
  ] as const;

  return (
    <aside className="hidden w-[312px] shrink-0 flex-col border-r border-[#d9e2d5] bg-[#173a27] text-white lg:flex">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0b35b] text-base font-semibold text-[#173a27]">
            CP
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] text-[#f6f7f2]">Concierge do Passageiro</p>
            <p className="mt-1 text-xs text-white/60">Operacao da agencia, passageiro e IA</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {groups.map((group) => (
          <div key={group.key} className="space-y-2">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              {group.label}
            </p>
            <div className="space-y-1.5">
              {adminNavigation
                .filter((item) => item.group === group.key)
                .map((item) => {
                  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-start gap-3 rounded-2xl px-3 py-3 transition-all',
                        active
                          ? 'bg-white text-[#173a27] shadow-[0_12px_40px_rgba(0,0,0,0.14)]'
                          : 'text-white/78 hover:bg-white/8 hover:text-white'
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl',
                        active ? 'bg-[#edf4eb] text-[#1f6b46]' : 'bg-white/10 text-white/78'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className={cn('mt-0.5 text-xs leading-5', active ? 'text-[#516052]' : 'text-white/45')}>
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {isPlatformOwner && (
        <div className="border-t border-white/10 px-6 py-5">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Stack atual</p>
            <p className="mt-2 text-sm font-medium text-white">Next.js, Prisma, Supabase</p>
            <p className="mt-1 text-xs leading-5 text-white/50">Auth, storage e realtime via Supabase.</p>
          </div>
        </div>
      )}
    </aside>
  );
}
