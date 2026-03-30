import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: 'operacao' | 'atendimento' | 'plataforma';
}

export const adminNavigation: AdminNavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Visao operacional da agencia',
    icon: LayoutDashboard,
    group: 'operacao',
  },
  {
    href: '/dashboard/passengers',
    label: 'Passageiros',
    description: 'Cadastro, viagens e documentos',
    icon: UsersRound,
    group: 'operacao',
  },
  {
    href: '/dashboard/alerts',
    label: 'Alertas',
    description: 'Eventos criticos e monitoramento',
    icon: Bell,
    group: 'atendimento',
  },
  {
    href: '/dashboard/conversations',
    label: 'Conversas',
    description: 'WhatsApp e historico de atendimento',
    icon: MessageSquareText,
    group: 'atendimento',
  },
  {
    href: '/dashboard/passenger-area',
    label: 'Area do Passageiro',
    description: 'Experiencia do passageiro e timeline',
    icon: ShieldCheck,
    group: 'atendimento',
  },
  {
    href: '/dashboard/settings',
    label: 'Configuracoes',
    description: 'Auth, storage, WhatsApp e Supabase',
    icon: Settings2,
    group: 'plataforma',
  },
];

// Paths that are sub-resources of Passageiros (trips and documents are managed
// from within the passenger view, not as top-level menu items)
const PASSENGER_SUB_PATHS = ['/dashboard/trips', '/dashboard/documents'];

export function getAdminNavItem(pathname: string): AdminNavItem | undefined {
  const direct = adminNavigation.find((item) =>
    pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
  );
  if (direct) return direct;

  if (PASSENGER_SUB_PATHS.some((p) => pathname.startsWith(p))) {
    return adminNavigation.find((item) => item.href === '/dashboard/passengers');
  }

  return undefined;
}

