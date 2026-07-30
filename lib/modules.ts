import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  Castle,
  Check,
  ClipboardCheck,
  Crosshair,
  Crown,
  Cpu,
  Bot,
  Factory,
  Dumbbell,
  FileText,
  Heart,
  Home,
  Link2,
  PlugZap,
  HardDrive,
  Mail,
  Languages,
  Megaphone,
  MapPin,
  Globe,
  Layers,
  LineChart,
  Rocket,
  Settings,
  Share2,
  Sparkles,
  Compass,
  Stethoscope,
  ScrollText,
  Star,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
  CircleDollarSign,
  Gift,
  ShieldCheck,
  ImageIcon,
  FolderKanban,
} from "lucide-react";

export type ModuleId =
  | "financeiro"
  | "calendario"
  | "alvesz"
  | "saude"
  | "social-media"
  | "crescimento"
  | "comunicacao"
  | "viagens"
  | "idiomas"
  | "disney-nba"
  | "legado"
  | "creator"
  | "smart-launch"
  | "mission"
  | "missions"
  | "money"
  | "revenue"
  | "revenue-ai"
  | "ceo"
  | "operation-center"
  | "master-flow"
  | "execution"
  | "performance"
  | "growth-brain"
  | "expert-brain"
  | "opportunities"
  | "market-hunter"
  | "offer-engine"
  | "funnel-pages"
  | "conversion-intelligence"
  | "excellence"
  | "ads-commander"
  | "creative-director"
  | "autopilot"
  | "product-factory"
  | "platforms"
  | "integrations"
  | "global"
  | "knowledge"
  | "knowledge-sources";

/** Aura OS 2.0 — contexts that organize the product by life area. */
export type OsContext =
  | "vida"
  | "negocios"
  | "alvesz"
  | "aura"
  | "configuracoes";

export const OS_CONTEXT_LABELS: Record<OsContext, string> = {
  vida: "Vida",
  negocios: "Negócios",
  alvesz: "Alvesz Experience",
  aura: "Aura",
  configuracoes: "Configurações",
};

export type ModuleConfig = {
  id: ModuleId;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  /** OS 2.0 context used for breadcrumbs and overview grouping. */
  context: OsContext;
  overview: {
    metric: string;
    value: string;
    hint: string;
  };
};

export const MODULES: ModuleConfig[] = [
  {
    id: "missions",
    href: "/dashboard/missions",
    label: "Missões",
    shortLabel: "Missões",
    description:
      "Organize a vida por missões — fases, marcos, riscos e progresso.",
    icon: Crosshair,
    accent: "text-amber-400",
    context: "vida",
    overview: {
      metric: "Ativas",
      value: "—",
      hint: "Nenhuma missão criada",
    },
  },
  {
    id: "financeiro",
    href: "/dashboard/financeiro",
    label: "Financeiro Pessoal",
    shortLabel: "Financeiro",
    description: "Controle de gastos, receitas e metas financeiras.",
    icon: Wallet,
    accent: "text-emerald-400",
    context: "vida",
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
    context: "vida",
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
    context: "alvesz",
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
    context: "vida",
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
    shortLabel: "Marketing IA",
    description: "Inteligência integrada: oportunidades, metas, relatório e IA Coach.",
    icon: Share2,
    accent: "text-amber-400",
    context: "negocios",
    overview: {
      metric: "Conteúdos",
      value: "0",
      hint: "Nenhum conteúdo planejado",
    },
  },
  {
    id: "crescimento",
    href: "/dashboard/crescimento",
    label: "Crescimento Digital",
    shortLabel: "Growth",
    description:
      "Missões, vendas online, análise de perfis e estratégias de crescimento.",
    icon: Rocket,
    accent: "text-cyan-400",
    context: "negocios",
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
    context: "negocios",
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
    context: "vida",
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
    context: "vida",
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
    context: "vida",
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
    context: "vida",
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
    shortLabel: "Creator IA",
    description:
      "Pipeline completo: ideia → escala. Market Research, CopyLab, Launch Center, checklists, scores IA e integração Legado + Financeiro.",
    icon: Sparkles,
    accent: "text-violet-400",
    context: "negocios",
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
    context: "negocios",
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
    context: "negocios",
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
    shortLabel: "Investimentos",
    description:
      "Transforme metas financeiras em planos executáveis com IA — integrando todos os módulos da Aura.",
    icon: Banknote,
    accent: "text-emerald-400",
    context: "negocios",
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
    context: "negocios",
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
    context: "negocios",
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
    shortLabel: "CEO Advisor",
    description:
      "Inteligência central — estratégias e planos de ação integrando todos os módulos da Aura.",
    icon: Crown,
    accent: "text-violet-400",
    context: "negocios",
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
    context: "negocios",
    overview: {
      metric: "Score",
      value: "—",
      hint: "Nenhuma operação ativa",
    },
  },
  {
    id: "master-flow",
    href: "/dashboard/master-flow",
    label: "Mission Core",
    shortLabel: "Mission Core",
    description:
      "Crie uma missão comercial completa — produto, oferta, landing, copy e campanha prontos para revisão.",
    icon: Layers,
    accent: "text-cyan-400",
    context: "negocios",
    overview: {
      metric: "Ativos",
      value: "—",
      hint: "Descreva seu objetivo e crie uma missão",
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
    context: "negocios",
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
    context: "negocios",
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
    context: "negocios",
    overview: {
      metric: "Memórias",
      value: "0",
      hint: "Registre resultados para aprender padrões",
    },
  },
  {
    id: "expert-brain",
    href: "/dashboard/expert-brain",
    label: "Expert Brain",
    shortLabel: "Expert Brain",
    description:
      "Ingestão de cursos e materiais — extrai frameworks, decision rules e padrões de sucesso/falha.",
    icon: Sparkles,
    accent: "text-amber-400",
    context: "negocios",
    overview: {
      metric: "Frameworks",
      value: "0",
      hint: "Faça upload de cursos para alimentar o Aura",
    },
  },
  {
    id: "opportunities",
    href: "/dashboard/opportunities",
    label: "Opportunity Engine",
    shortLabel: "Opportunity Engine",
    description:
      "Recomenda as melhores oportunidades de produtos digitais com base na sua meta financeira.",
    icon: Target,
    accent: "text-emerald-400",
    context: "negocios",
    overview: {
      metric: "Top 3",
      value: "—",
      hint: "Informe seu objetivo financeiro mensal",
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
    context: "negocios",
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
    context: "negocios",
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
    context: "negocios",
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
    context: "negocios",
    overview: {
      metric: "Insights",
      value: "0",
      hint: "Analise padrões de Growth Brain e Revenue AI",
    },
  },
  {
    id: "excellence",
    href: "/dashboard/excellence",
    label: "Aura Excellence Engine",
    shortLabel: "Excellence",
    description:
      "Auditoria de especialistas virtuais — nenhum ativo é entregue sem score de qualidade.",
    icon: ShieldCheck,
    accent: "text-violet-400",
    context: "negocios",
    overview: {
      metric: "Média",
      value: "—",
      hint: "Audite produtos, copies, criativos e campanhas",
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
    context: "negocios",
    overview: {
      metric: "Preparadas",
      value: "0",
      hint: "Monte campanhas e aprove manualmente",
    },
  },
  {
    id: "creative-director",
    href: "/dashboard/creative-director",
    label: "Creative Director",
    shortLabel: "Creative",
    description:
      "Gera assets reais de imagem via OpenAI Images e Flux — prompt otimizado, Excellence review e download.",
    icon: ImageIcon,
    accent: "text-fuchsia-400",
    context: "negocios",
    overview: {
      metric: "Assets reais",
      value: "—",
      hint: "Gere imagens prontas para anúncios",
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
    context: "negocios",
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
    shortLabel: "Product Factory",
    description:
      "Crie e-books completos com conteúdo, design, PDF baixável e compliance para anúncios.",
    icon: Factory,
    accent: "text-pink-400",
    context: "negocios",
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
    context: "negocios",
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
    context: "aura",
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
    context: "negocios",
    overview: {
      metric: "Global Score",
      value: "—",
      hint: "Analise mercados internacionais",
    },
  },
  {
    id: "knowledge-sources",
    href: "/dashboard/knowledge-sources",
    label: "Knowledge Sources",
    shortLabel: "Google Drive",
    description:
      "Aprenda de cursos no Google Drive e uploads TXT/PDF — extrai conhecimento sem armazenar vídeos.",
    icon: HardDrive,
    accent: "text-cyan-400",
    context: "aura",
    overview: {
      metric: "Fontes",
      value: "0",
      hint: "Conecte o Drive ou faça upload de materiais",
    },
  },
  {
    id: "knowledge",
    href: "/dashboard/knowledge",
    label: "Knowledge Hub",
    shortLabel: "Knowledge",
    description:
      "Repositório inteligente de documentos, notas, links e arquivos — indexados para Memory, World, Cognitive e Discovery.",
    icon: BookOpen,
    accent: "text-amber-400",
    context: "aura",
    overview: {
      metric: "Documentos",
      value: "—",
      hint: "Centralize conhecimento do workspace",
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

export function getModuleByHref(pathname: string): ModuleConfig | null {
  const exact = MODULES.find((m) => m.href === pathname);
  if (exact) return exact;
  return (
    MODULES.find(
      (m) => m.href !== "/dashboard" && pathname.startsWith(`${m.href}/`)
    ) ?? null
  );
}

export function getModuleBreadcrumb(module: ModuleConfig): string[] {
  if (module.context === "alvesz") {
    return [OS_CONTEXT_LABELS.alvesz];
  }
  return [OS_CONTEXT_LABELS[module.context], module.shortLabel];
}

export function modulesByContext(context: OsContext): ModuleConfig[] {
  return MODULES.filter((m) => m.context === context);
}

export function isModuleActive(
  pathname: string,
  href: string
): boolean {
  const pathOnly = pathname.split("#")[0] ?? pathname;
  const hrefPath = href.split("#")[0] ?? href;

  if (hrefPath === "/dashboard") {
    return pathOnly === "/dashboard";
  }

  return pathOnly === hrefPath || pathOnly.startsWith(`${hrefPath}/`);
}

// ---------------------------------------------------------------------------
// Aura OS 2.0 — contextual navigation tree
// ---------------------------------------------------------------------------

export type OsNavLink = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  accent?: string;
  children?: OsNavLink[];
};

export type OsNavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Standalone section link (Dashboard / Alvesz). */
  href?: string;
  accent?: string;
  items?: OsNavLink[];
};

function navFromModule(
  id: ModuleId,
  labelOverride?: string
): OsNavLink {
  const mod = getModule(id);
  return {
    id: mod.id,
    href: mod.href,
    label: labelOverride ?? mod.shortLabel,
    icon: mod.icon,
    accent: mod.accent,
  };
}

/**
 * Primary OS navigation. Curated tree by context.
 * Remaining business modules stay reachable under Negócios so nothing is lost.
 */
export const OS_NAV: OsNavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Home,
    href: "/dashboard",
  },
  {
    id: "vida",
    label: "Vida",
    icon: Heart,
    items: [
      navFromModule("missions"),
      navFromModule("financeiro"),
      {
        ...navFromModule("saude"),
        children: [
          {
            id: "saude-treinos",
            href: "/dashboard/saude#treinos",
            label: "Treinos",
            icon: Dumbbell,
            accent: "text-rose-400",
          },
          {
            id: "saude-dieta",
            href: "/dashboard/saude#dieta",
            label: "Dieta",
            icon: Utensils,
            accent: "text-emerald-400",
          },
          {
            id: "saude-habitos",
            href: "/dashboard/saude#habitos",
            label: "Hábitos",
            icon: Check,
            accent: "text-sky-400",
          },
        ],
      },
      navFromModule("calendario"),
      navFromModule("viagens"),
      navFromModule("idiomas"),
      {
        id: "objetivos",
        href: GOALS_NAV.href,
        label: "Objetivos",
        icon: GOALS_NAV.icon,
        accent: "text-amber-400",
      },
      navFromModule("disney-nba"),
      navFromModule("legado"),
    ],
  },
  {
    id: "negocios",
    label: "Negócios",
    icon: Briefcase,
    items: [
      navFromModule("ceo", "CEO Advisor"),
      navFromModule("opportunities", "Opportunity Engine"),
      navFromModule("master-flow", "Mission Core"),
      navFromModule("product-factory", "Product Factory"),
      navFromModule("expert-brain", "Expert Brain"),
      navFromModule("social-media", "Marketing IA"),
      navFromModule("creator", "Creator IA"),
      navFromModule("crescimento", "Growth"),
      navFromModule("money", "Investimentos"),
      // Remaining business capabilities (preserved, not removed)
      navFromModule("growth-brain"),
      navFromModule("revenue"),
      navFromModule("revenue-ai"),
      navFromModule("mission"),
      navFromModule("smart-launch"),
      navFromModule("operation-center"),
      navFromModule("execution"),
      navFromModule("performance"),
      navFromModule("market-hunter"),
      navFromModule("offer-engine"),
      navFromModule("funnel-pages"),
      navFromModule("conversion-intelligence"),
      navFromModule("excellence"),
      navFromModule("ads-commander"),
      navFromModule("creative-director"),
      navFromModule("autopilot"),
      navFromModule("platforms"),
      navFromModule("global"),
      navFromModule("comunicacao"),
    ],
  },
  {
    id: "alvesz",
    label: "Alvesz Experience",
    icon: Building2,
    href: "/dashboard/alvesz",
    accent: "text-violet-400",
  },
  {
    id: "aura",
    label: "Aura Brain",
    icon: Sparkles,
    items: [
      {
        id: "inbox",
        href: "/dashboard/inbox",
        label: "Inbox",
        icon: Mail,
        accent: "text-cyan-300",
      },
      {
        id: "feed",
        href: "/dashboard/feed",
        label: "Feed",
        icon: Layers,
        accent: "text-sky-300",
      },
      {
        id: "favorites",
        href: "/dashboard/favorites",
        label: "Favoritos",
        icon: Star,
        accent: "text-amber-300",
      },
      {
        id: "projects",
        href: "/dashboard/projects",
        label: "Projetos",
        icon: FolderKanban,
        accent: "text-emerald-300",
      },
      {
        id: "business",
        href: "/dashboard/business",
        label: "Business Hub",
        icon: Building2,
        accent: "text-violet-300",
      },
      {
        id: "knowledge-hub",
        href: "/dashboard/knowledge",
        label: "Knowledge Hub",
        icon: BookOpen,
        accent: "text-amber-300",
      },
      {
        id: "decisions",
        href: "/dashboard/decisions",
        label: "Decision Center",
        icon: Crosshair,
        accent: "text-orange-300",
      },
      {
        id: "scenarios",
        href: "/dashboard/scenarios",
        label: "Scenario Center",
        icon: Compass,
        accent: "text-sky-300",
      },
      {
        id: "priorities",
        href: "/dashboard/priorities",
        label: "Priority Center",
        icon: Target,
        accent: "text-lime-300",
      },
      {
        id: "discovery",
        href: "/dashboard/discovery",
        label: "Descobertas",
        icon: Compass,
        accent: "text-rose-300",
      },
      {
        id: "knowledge-connect",
        href: "/dashboard/knowledge/connect",
        label: "Knowledge Connect",
        icon: BookOpen,
        accent: "text-amber-400",
      },
      {
        id: "memoria",
        href: MEMORY_NAV.href,
        label: "Memória",
        icon: MEMORY_NAV.icon,
        accent: "text-violet-400",
      },
      {
        id: "aura-settings",
        href: "/dashboard/settings/aura-brain",
        label: "Preferências Brain",
        icon: Settings,
        accent: "text-zinc-400",
      },
      navFromModule("integrations", "Integrações"),
      navFromModule("knowledge-sources", "Google Drive"),
      {
        id: "expert-brain-queue",
        href: "/dashboard/expert-brain",
        label: "Expert Brain Queue",
        icon: Sparkles,
        accent: "text-amber-400",
      },
      {
        id: "logs",
        href: LOGS_NAV.href,
        label: "Logs",
        icon: LOGS_NAV.icon,
        accent: "text-orange-400",
      },
      {
        id: "diagnostico",
        href: DIAGNOSTICS_NAV.href,
        label: "Diagnóstico",
        icon: DIAGNOSTICS_NAV.icon,
        accent: "text-teal-400",
      },
      {
        id: "black-health",
        href: BLACK_HEALTH_NAV.href,
        label: BLACK_HEALTH_NAV.label,
        icon: BLACK_HEALTH_NAV.icon,
        accent: "text-rose-400",
      },
      {
        id: "feed-inspector",
        href: FEED_INSPECTOR_NAV.href,
        label: FEED_INSPECTOR_NAV.label,
        icon: FEED_INSPECTOR_NAV.icon,
        accent: "text-cyan-400",
      },
      {
        id: "decision-engine",
        href: DECISION_ENGINE_NAV.href,
        label: DECISION_ENGINE_NAV.label,
        icon: DECISION_ENGINE_NAV.icon,
        accent: "text-violet-400",
      },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    icon: Settings,
    items: [
      {
        id: "settings-hub",
        href: "/dashboard/settings",
        label: "Central",
        icon: Settings,
        accent: "text-zinc-300",
      },
      {
        id: "perfil",
        href: "/dashboard/perfil",
        label: "Perfil",
        icon: Crown,
        accent: "text-amber-300",
      },
      {
        id: "workspace",
        href: "/dashboard/workspace",
        label: "Workspace",
        icon: Building2,
        accent: "text-violet-400",
      },
      {
        id: "notificacoes",
        href: NOTIFICATIONS_NAV.href,
        label: "Notificações",
        icon: NOTIFICATIONS_NAV.icon,
        accent: "text-amber-400",
      },
      {
        id: "relatorios",
        href: REPORTS_NAV.href,
        label: "Relatórios",
        icon: REPORTS_NAV.icon,
        accent: "text-cyan-400",
      },
      {
        id: "business-intelligence",
        href: BI_NAV.href,
        label: "Business Intelligence",
        icon: BI_NAV.icon,
        accent: "text-violet-400",
      },
    ],
  },
];
