import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Banknote,
  Building2,
  CalendarDays,
  Castle,
  ClipboardCheck,
  Crosshair,
  Crown,
  Cpu,
  Bot,
  Factory,
  Dumbbell,
  FileText,
  Home,
  Link2,
  PlugZap,
  Mail,
  Languages,
  Megaphone,
  MapPin,
  Globe,
  Layers,
  LineChart,
  Rocket,
  Share2,
  Sparkles,
  Stethoscope,
  ScrollText,
  Star,
  Target,
  TrendingUp,
  Wallet,
  CircleDollarSign,
  Gift,
} from "lucide-react";

export type ModuleId =
  | "financeiro"
  | "calendario"
  | "alvesz"
  | "saude"
  | "social-media"
  | "consorcios"
  | "crescimento"
  | "comunicacao"
  | "viagens"
  | "idiomas"
  | "disney-nba"
  | "legado"
  | "creator"
  | "smart-launch"
  | "mission"
  | "money"
  | "revenue"
  | "revenue-ai"
  | "ceo"
  | "operation-center"
  | "execution"
  | "performance"
  | "growth-brain"
  | "market-hunter"
  | "offer-engine"
  | "funnel-pages"
  | "conversion-intelligence"
  | "ads-commander"
  | "autopilot"
  | "product-factory"
  | "platforms"
  | "integrations"
  | "global"
  | "knowledge";

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
    description: "Inteligência integrada: oportunidades, metas, relatório e IA Coach.",
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
  {
    id: "viagens",
    href: "/dashboard/viagens",
    label: "Aura Travel",
    shortLabel: "Viagens",
    description: "Planeje e acompanhe viagens com checklist, IA e integrações.",
    icon: MapPin,
    accent: "text-teal-400",
    overview: {
      metric: "Viagens",
      value: "0",
      hint: "Nenhuma viagem planejada",
    },
  },
  {
    id: "idiomas",
    href: "/dashboard/idiomas",
    label: "Aura English Coach",
    shortLabel: "Idiomas",
    description: "Inglês personalizado para viagens, Disney, NBA e negócios.",
    icon: Languages,
    accent: "text-violet-400",
    overview: {
      metric: "Streak",
      value: "0d",
      hint: "Comece sua primeira aula de inglês",
    },
  },
  {
    id: "disney-nba",
    href: "/dashboard/disney-nba",
    label: "Central Disney + NBA",
    shortLabel: "Disney + NBA",
    description:
      "Acompanhe toda a preparação da viagem: finanças, checklist, inglês e calendário.",
    icon: Castle,
    accent: "text-fuchsia-400",
    overview: {
      metric: "Contagem",
      value: "—",
      hint: "Crie a viagem Disney + NBA para começar",
    },
  },
  {
    id: "legado",
    href: "/dashboard/legado",
    label: "Legado & Hall da Fama",
    shortLabel: "Legado",
    description:
      "Trajetória de vida, conquistas, certificados e marcos — contexto permanente da Aura.",
    icon: Star,
    accent: "text-yellow-400",
    overview: {
      metric: "Conquistas",
      value: "0",
      hint: "Registre sua trajetória desde 2016",
    },
  },
  {
    id: "creator",
    href: "/dashboard/creator",
    label: "Aura Creator",
    shortLabel: "Creator",
    description:
      "Pipeline completo: ideia → escala. Market Research, CopyLab, Launch Center, checklists, scores IA e integração Legado + Financeiro.",
    icon: Sparkles,
    accent: "text-violet-400",
    overview: {
      metric: "Produtos",
      value: "0",
      hint: "Pipeline inteligente com checklist e ROI",
    },
  },
  {
    id: "smart-launch",
    href: "/dashboard/smart-launch",
    label: "Aura Smart Launch",
    shortLabel: "Smart Launch",
    description:
      "Fluxo unificado de lançamento — do produto à campanha Meta em modo seguro, com Smart Score e orquestração de todos os módulos.",
    icon: Rocket,
    accent: "text-orange-400",
    overview: {
      metric: "Smart Score",
      value: "—",
      hint: "Prepare um lançamento completo em 4 etapas",
    },
  },
  {
    id: "mission",
    href: "/dashboard/mission",
    label: "Aura Mission Control",
    shortLabel: "Mission",
    description:
      "Central de operações do Smart Launch — missão ativa, progresso, revenue, CEO, execution e performance em um painel.",
    icon: Target,
    accent: "text-cyan-400",
    overview: {
      metric: "Missão",
      value: "—",
      hint: "Nenhuma missão ativa",
    },
  },
  {
    id: "money",
    href: "/dashboard/money",
    label: "Aura Money Missions",
    shortLabel: "Money",
    description:
      "Transforme metas financeiras em planos executáveis com IA — integrando todos os módulos da Aura.",
    icon: Banknote,
    accent: "text-emerald-400",
    overview: {
      metric: "Meta",
      value: "—",
      hint: "Nenhuma missão financeira ativa",
    },
  },
  {
    id: "revenue",
    href: "/dashboard/revenue",
    label: "Aura Revenue Center",
    shortLabel: "Revenue",
    description:
      "Centralize receitas e despesas da operação digital — lucro, ROI e investimento em um só lugar.",
    icon: CircleDollarSign,
    accent: "text-emerald-400",
    overview: {
      metric: "Lucro mês",
      value: "—",
      hint: "Conecte fontes de receita e despesas",
    },
  },
  {
    id: "revenue-ai",
    href: "/dashboard/revenue-ai",
    label: "Revenue AI",
    shortLabel: "Revenue AI",
    description:
      "Centro de inteligência financeira e comercial — previsões, ROAS, ROI e insights por plataforma.",
    icon: LineChart,
    accent: "text-emerald-400",
    overview: {
      metric: "Receita",
      value: "—",
      hint: "Registre vendas para gerar inteligência",
    },
  },
  {
    id: "ceo",
    href: "/dashboard/ceo",
    label: "Aura CEO",
    shortLabel: "CEO",
    description:
      "Inteligência central — estratégias e planos de ação integrando todos os módulos da Aura.",
    icon: Crown,
    accent: "text-violet-400",
    overview: {
      metric: "Score IA",
      value: "—",
      hint: "Faça uma pergunta estratégica",
    },
  },
  {
    id: "operation-center",
    href: "/dashboard/operation-center",
    label: "Operation Center",
    shortLabel: "Operations",
    description:
      "Central de execução operacional — prepare operações completas para aprovação em modo seguro.",
    icon: ClipboardCheck,
    accent: "text-fuchsia-400",
    overview: {
      metric: "Score",
      value: "—",
      hint: "Nenhuma operação ativa",
    },
  },
  {
    id: "execution",
    href: "/dashboard/execution",
    label: "Aura Execution Engine",
    shortLabel: "Execution",
    description:
      "Transforme planos da Aura em tarefas executáveis com Daily Briefing e Executive Memory.",
    icon: Cpu,
    accent: "text-cyan-400",
    overview: {
      metric: "Missões",
      value: "0",
      hint: "Gere seu plano diário",
    },
  },
  {
    id: "performance",
    href: "/dashboard/performance",
    label: "Aura Performance AI",
    shortLabel: "Performance",
    description:
      "Analise resultados cross-module e tome decisões estratégicas com IA executiva.",
    icon: TrendingUp,
    accent: "text-emerald-400",
    overview: {
      metric: "Score",
      value: "—",
      hint: "Gere sua análise de performance",
    },
  },
  {
    id: "growth-brain",
    href: "/dashboard/growth-brain",
    label: "Growth Brain",
    shortLabel: "Growth Brain",
    description:
      "Sistema de aprendizado — cada venda, clique e campanha alimenta a inteligência do Aura.",
    icon: Brain,
    accent: "text-violet-400",
    overview: {
      metric: "Memórias",
      value: "0",
      hint: "Registre resultados para aprender padrões",
    },
  },
  {
    id: "market-hunter",
    href: "/dashboard/market-hunter",
    label: "Market Hunter",
    shortLabel: "Market Hunter",
    description:
      "Descoberta automática de oportunidades — encontre o produto certo para vender agora.",
    icon: Crosshair,
    accent: "text-emerald-400",
    overview: {
      metric: "Score",
      value: "—",
      hint: "Execute uma análise de mercado",
    },
  },
  {
    id: "offer-engine",
    href: "/dashboard/offer-engine",
    label: "Offer Engine Pro",
    shortLabel: "Offers",
    description:
      "Monetização automática — gera bumps, upsells, downsells, VIP e continuidade por produto.",
    icon: Gift,
    accent: "text-fuchsia-400",
    overview: {
      metric: "AOV",
      value: "—",
      hint: "Gere a stack de ofertas de um produto",
    },
  },
  {
    id: "funnel-pages",
    href: "/dashboard/funnel-pages",
    label: "Funnel Pages Pro",
    shortLabel: "Funnel Pages",
    description:
      "Gera automaticamente todas as páginas do funil — front-end, upsells, downsells, quiz e thank you.",
    icon: Layers,
    accent: "text-cyan-400",
    overview: {
      metric: "Páginas",
      value: "0",
      hint: "Gere páginas após criar funil e ofertas",
    },
  },
  {
    id: "conversion-intelligence",
    href: "/dashboard/conversion-intelligence",
    label: "Conversion Intelligence",
    shortLabel: "Conversion AI",
    description:
      "IA que aprende padrões reais de conversão — explica por que converteu ou não e recomenda ações.",
    icon: LineChart,
    accent: "text-lime-400",
    overview: {
      metric: "Insights",
      value: "0",
      hint: "Analise padrões de Growth Brain e Revenue AI",
    },
  },
  {
    id: "ads-commander",
    href: "/dashboard/ads-commander",
    label: "Ads Commander",
    shortLabel: "Ads Commander",
    description:
      "Prepara campanhas completas para Meta, Google e futuras plataformas — nunca publica automaticamente.",
    icon: Megaphone,
    accent: "text-orange-400",
    overview: {
      metric: "Preparadas",
      value: "0",
      hint: "Monte campanhas e aprove manualmente",
    },
  },
  {
    id: "autopilot",
    href: "/dashboard/creator/autopilot",
    label: "Aura Autopilot",
    shortLabel: "Autopilot",
    description:
      "Monitore campanhas, tome decisões seguras e peça aprovação para ações sensíveis.",
    icon: Bot,
    accent: "text-orange-400",
    overview: {
      metric: "Pendentes",
      value: "0",
      hint: "Nenhuma ação pendente",
    },
  },
  {
    id: "product-factory",
    href: "/dashboard/creator/factory",
    label: "Aura Product Factory",
    shortLabel: "Factory",
    description:
      "Crie e-books completos com conteúdo, design, PDF baixável e compliance para anúncios.",
    icon: Factory,
    accent: "text-pink-400",
    overview: {
      metric: "Produtos",
      value: "0",
      hint: "Nenhum produto digital criado",
    },
  },
  {
    id: "platforms",
    href: "/dashboard/platforms",
    label: "Aura Platform Hub",
    shortLabel: "Platforms",
    description:
      "Centralize integrações com Kiwify, Hotmart, Eduzz, Monetizze — vendas, afiliados e Score IA.",
    icon: Link2,
    accent: "text-indigo-400",
    overview: {
      metric: "Plataformas",
      value: "0",
      hint: "Conecte sua primeira plataforma de vendas",
    },
  },
  {
    id: "integrations",
    href: "/dashboard/integrations",
    label: "Aura Integration Center",
    shortLabel: "Integrações",
    description:
      "Central de integrações externas — Meta, Kiwify, sync unificado, logs e status em um só lugar.",
    icon: PlugZap,
    accent: "text-cyan-400",
    overview: {
      metric: "Conectadas",
      value: "0",
      hint: "Conecte Meta Business ou Kiwify",
    },
  },
  {
    id: "global",
    href: "/dashboard/global",
    label: "Aura Global Intelligence",
    shortLabel: "Global",
    description:
      "Escolha automaticamente a melhor estratégia para cada mercado internacional — país, idioma, moeda e Global Score.",
    icon: Globe,
    accent: "text-sky-400",
    overview: {
      metric: "Global Score",
      value: "—",
      hint: "Analise mercados internacionais",
    },
  },
  {
    id: "knowledge",
    href: "/dashboard/knowledge",
    label: "Aura Knowledge & Connect",
    shortLabel: "Knowledge",
    description:
      "Aprenda com fontes externas — campanhas, produtos, copies e mercados vencedores com Executive Memory.",
    icon: BookOpen,
    accent: "text-amber-400",
    overview: {
      metric: "Entradas",
      value: "0",
      hint: "Conecte fontes e sincronize aprendizado",
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

export const LEGADO_NAV = {
  href: "/dashboard/legado",
  label: "Legado & Hall da Fama",
  icon: Star,
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

export const BLACK_HEALTH_NAV = {
  href: "/dashboard/black-health",
  label: "Black Health",
  icon: Stethoscope,
};

export const FEED_INSPECTOR_NAV = {
  href: "/dashboard/feed-inspector",
  label: "Feed Inspector",
  icon: Crosshair,
};

export const DECISION_ENGINE_NAV = {
  href: "/dashboard/decision-engine",
  label: "Decision Engine",
  icon: Cpu,
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