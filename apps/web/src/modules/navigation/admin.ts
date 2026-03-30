import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Files,
  LayoutDashboard,
  MessageSquareText,
  PlaneTakeoff,
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
    description: 'Resumo operacional e pendencias da agencia',
    icon: LayoutDashboard,
    group: 'operacao',
  },
  {
    href: '/dashboard/passengers',
    label: 'Passageiros',
    description: 'Hub principal com cadastro, jornadas e atendimento',
    icon: UsersRound,
    group: 'operacao',
  },
  {
    href: '/dashboard/trips',
    label: 'Jornadas Globais',
    description: 'Visao transversal das jornadas da agencia',
    icon: PlaneTakeoff,
    group: 'operacao',
  },
  {
    href: '/dashboard/documents',
    label: 'Biblioteca Documental',
    description: 'Auditoria, processamento e base global de arquivos',
    icon: Files,
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

export function getAdminNavItem(pathname: string): AdminNavItem | undefined {
  return adminNavigation.find((item) =>
    pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
  );
}
