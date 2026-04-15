'use client';

import { usePathname } from 'next/navigation';
import { Bell, LogOut, Search, Sparkles } from 'lucide-react';
import { getAdminNavItem } from '@/modules/navigation/admin';

interface Props {
  user: { name: string; email: string; role: string };
}

export default function Header({ user }: Props) {
  const pathname = usePathname();
  const currentItem = getAdminNavItem(pathname);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <header className="border-b border-[#d9e2d5] bg-[#f8f6ef]/90 px-6 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d9e2d5] bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#617063]">
            <Sparkles className="h-3.5 w-3.5 text-[#1f6b46]" />
            Produto operacional
          </div>
          <div>
            <p className="text-lg font-semibold tracking-[-0.04em] text-[#142018]">
              {currentItem?.label ?? 'Concierge do Passageiro'}
            </p>
            <p className="text-sm text-[#5b665d]">
              {currentItem?.description ?? 'Base modular da operacao da agencia e da experiencia do passageiro.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden min-w-[250px] items-center gap-2 rounded-2xl border border-[#d9e2d5] bg-white px-3 py-2 text-sm text-[#6d776e] xl:flex">
            <Search className="h-4 w-4" />
            Buscar passageiro, viagem ou documento
          </div>

          <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d9e2d5] bg-white text-[#314436]">
            <Bell className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 rounded-[20px] border border-[#d9e2d5] bg-white px-3 py-2.5">
            <div className="text-right">
              <p className="text-sm font-semibold text-[#142018]">{user.name}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-[#7b857b]">{user.role}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ecf6ea] text-sm font-semibold text-[#1f6b46]">
              {user.name[0]}
            </div>
            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#6d776e] transition-colors hover:bg-[#f4f7f1] hover:text-[#142018]"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
