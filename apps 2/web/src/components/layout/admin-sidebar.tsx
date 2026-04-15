'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Building2, LayoutDashboard, Settings2 } from 'lucide-react';

const navigation = [
  {
    group: 'plataforma',
    label: 'Plataforma',
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        description: 'Visao geral do sistema',
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: '/admin/agencies',
        label: 'Agencias',
        description: 'Cadastro e controle de agencias',
        icon: Building2,
        exact: false,
      },
    ],
  },
  {
    group: 'sistema',
    label: 'Sistema',
    items: [
      {
        href: '/admin/settings',
        label: 'Configuracoes',
        description: 'Parametros e funcionalidades',
        icon: Settings2,
        exact: false,
      },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-r border-white/8 bg-[#0f1a14] text-white lg:flex">
      <div className="border-b border-white/8 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0b35b] text-sm font-bold text-[#0f1a14]">
            CP
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Plataforma</p>
            <p className="mt-0.5 text-xs text-white/40">Administracao do sistema</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {navigation.map((group) => (
          <div key={group.group} className="space-y-1.5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
                      active
                        ? 'bg-[#f0b35b]/12 text-[#f0b35b]'
                        : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      active ? 'bg-[#f0b35b]/15 text-[#f0b35b]' : 'bg-white/6 text-white/40'
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className={cn('text-xs', active ? 'text-[#f0b35b]/60' : 'text-white/30')}>
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

      <div className="border-t border-white/8 px-6 py-4">
        <p className="text-xs text-white/20">Concierge do Passageiro</p>
      </div>
    </aside>
  );
}
