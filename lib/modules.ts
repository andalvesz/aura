import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Brain,
  Building2,
  CalendarDays,
  Dumbbell,
  FileText,
  Home,
  Mail,
  Rocket,
  Share2,
  Stethoscope,
  ScrollText,
  Target,
  Wallet,
} from "lucide-react";

export type ModuleId =
  | "financeiro"
  | "calendario"
  | "alvesz"
  | "saude"
  | "social-media"
  | "consorcios"
  | "crescimento"
  | "comunicacao";

export type ModuleConfig = {
  id: ModuleId;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  overview: {
    metric: string;
    value: string;
    hint: string;
  };
};

export const MODULES: ModuleConfig[] = [
  {
    id: "financeiro",
    href: "/dashboard/financeiro",
    label: "Financeiro Pessoal",
    shortLabel: "Financeiro",
    description: "Controle de gastos, receitas e metas financeiras.",
    icon: Wallet,
    accent: "text-emerald-400",
    overview: {
      metric: "Status",
      value: "—",
      hint: "Nenhum dado financeiro cadastrado",
    },
  },
  {
    id: "calendario",
    href: "/dashboard/calendario",
    label: "Calendário com IA",
    shortLabel: "Calendário",
    description: "Agenda inteligente e organização pessoal.",
    icon: CalendarDays,
    accent: "text-sky-400",
    overview: {
      metric: "Eventos",
      value: "0",
      hint: "Nenhum evento cadastrado",
    },
  },
  {
    id: "alvesz",
    href: "/dashboard/alvesz",
    label: "Alvesz Experience",
    shortLabel: "Alvesz",
    description: "Clientes, estoque, eventos e orçamentos.",
    icon: Building2,
    accent: "text-violet-400",
    overview: {
      metric: "Orçamentos",
      value: "0",
      hint: "Nenhum orçamento cadastrado",
    },
  },
  {
    id: "saude",
    href: "/dashboard/saude",
    label: "Saúde, Treino e Mente",
    shortLabel: "Saúde",
    description: "Treino, alimentação, hábitos e evolução.",
    icon: Dumbbell,
    accent: "text-rose-400",
    overview: {
      metric: "Hábitos",
      value: "0",
      hint: "Nenhum hábito cadastrado",
    },
  },
  {
    id: "social-media",
    href: "/dashboard/social-media",
    label: "Instagram Inteligente",
    shortLabel: "Social Media",
    description: "Centro de crescimento: perfis, calendário, pipeline e IA.",
    icon: Share2,
    accent: "text-amber-400",
    overview: {
      metric: "Conteúdos",
      value: "0",
      hint: "Nenhum conteúdo planejado",
    },
  },
  {
    id: "consorcios",
    href: "/dashboard/consorcios",
    label: "Consórcios e Vendas",
    shortLabel: "Consórcios",
    description: "Leads, funil de vendas e estratégias.",
    icon: Target,
    accent: "text-orange-400",
    overview: {
      metric: "Leads",
      value: "0",
      hint: "Nenhum lead cadastrado",
    },
  },
  {
    id: "crescimento",
    href: "/dashboard/crescimento",
    label: "Crescimento Digital",
    shortLabel: "Crescimento",
    description:
      "Missões, vendas online, análise de perfis e estratégias de crescimento.",
    icon: Rocket,
    accent: "text-cyan-400",
    overview: {
      metric: "XP",
      value: "—",
      hint: "Nenhuma meta ou missão registrada",
    },
  },
  {
    id: "comunicacao",
    href: "/dashboard/comunicacao",
    label: "Centro de Comunicação",
    shortLabel: "Comunicação",
    description: "Gmail, propostas Alvesz, follow-up e mensagens.",
    icon: Mail,
    accent: "text-indigo-400",
    overview: {
      metric: "E-mails",
      value: "0",
      hint: "Conecte o Gmail para começar",
    },
  },
];

export const HOME_NAV = {
  href: "/dashboard",
  label: "Visão geral",
  icon: Home,
};

export const MEMORY_NAV = {
  href: "/dashboard/memoria",
  label: "Memória",
  icon: Brain,
};

export const REPORTS_NAV = {
  href: "/dashboard/relatorios",
  label: "Relatórios",
  icon: FileText,
};

export const GOALS_NAV = {
  href: "/dashboard/metas",
  label: "Metas",
  icon: Target,
};

export const BI_NAV = {
  href: "/dashboard/business-intelligence",
  label: "Business Intelligence",
  icon: BarChart3,
};

export const NOTIFICATIONS_NAV = {
  href: "/dashboard/notificacoes",
  label: "Notificações",
  icon: Bell,
};

export const DIAGNOSTICS_NAV = {
  href: "/dashboard/diagnostico",
  label: "Diagnóstico",
  icon: Stethoscope,
};

export const LOGS_NAV = {
  href: "/dashboard/logs",
  label: "Logs",
  icon: ScrollText,
};

export function getModule(id: ModuleId): ModuleConfig {
  const mod = MODULES.find((m) => m.id === id);

  if (!mod) {
    throw new Error(`Module not found: ${id}`);
  }

  return mod;
}

export function isModuleActive(
  pathname: string,
  href: string
): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}