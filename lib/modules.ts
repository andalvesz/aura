import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  Dumbbell,
  Home,
  Share2,
  Target,
  Wallet,
} from "lucide-react";

export type ModuleId =
  | "financeiro"
  | "calendario"
  | "alvesz"
  | "saude"
  | "social-media"
  | "consorcios";

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
    description: "Controle de gastos, categorias e previsão mensal.",
    icon: Wallet,
    accent: "text-emerald-400",
    overview: { metric: "Saldo estimado", value: "R$ 4.280", hint: "−12% vs mês anterior" },
  },
  {
    id: "calendario",
    href: "/dashboard/calendario",
    label: "Calendário com IA",
    shortLabel: "Calendário",
    description: "Agenda inteligente com assistente Aura IA.",
    icon: CalendarDays,
    accent: "text-sky-400",
    overview: { metric: "Próximo evento", value: "15:00", hint: "Reunião com cliente" },
  },
  {
    id: "alvesz",
    href: "/dashboard/alvesz",
    label: "Alvesz Experience",
    shortLabel: "Alvesz",
    description: "Eventos, orçamentos, estoque e precificação.",
    icon: Building2,
    accent: "text-violet-400",
    overview: { metric: "Faturamento previsto", value: "R$ 28.5k", hint: "3 eventos ativos" },
  },
  {
    id: "saude",
    href: "/dashboard/saude",
    label: "Saúde, Treino e Mente",
    shortLabel: "Saúde",
    description: "Treino, alimentação, hábitos e bem-estar.",
    icon: Dumbbell,
    accent: "text-rose-400",
    overview: { metric: "Hábitos hoje", value: "4/6", hint: "67% da meta semanal" },
  },
  {
    id: "social-media",
    href: "/dashboard/social-media",
    label: "Social Media Creator",
    shortLabel: "Social Media",
    description: "Calendário de conteúdo e roteiros com IA.",
    icon: Share2,
    accent: "text-amber-400",
    overview: { metric: "Vídeos planejados", value: "8", hint: "3 para esta semana" },
  },
  {
    id: "consorcios",
    href: "/dashboard/consorcios",
    label: "Consórcios e Vendas",
    shortLabel: "Consórcios",
    description: "Funil, leads, metas e estratégia diária.",
    icon: Target,
    accent: "text-orange-400",
    overview: { metric: "Leads hoje", value: "7", hint: "2 conversões pendentes" },
  },
];

export const HOME_NAV = {
  href: "/dashboard",
  label: "Visão geral",
  icon: Home,
};

export function getModule(id: ModuleId): ModuleConfig {
  const mod = MODULES.find((m) => m.id === id);
  if (!mod) throw new Error(`Module not found: ${id}`);
  return mod;
}

export function isModuleActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
