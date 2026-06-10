import type { MoneyMissionPlan, MoneyMissionTask } from "@/types/database";
import { formatBRL } from "@/utils/format";
import type { CreatorCurrency } from "@/utils/creator-locale";
import { formatCreatorMoney } from "@/utils/creator-locale";

export type MoneyPrazo = "30_dias" | "90_dias" | "6_meses" | "1_ano";
export type MoneyPrioridade = "seguranca" | "crescimento" | "escala";
export type MoneyMissionStatus = "active" | "completed" | "archived";

export const MONEY_PRAZO_OPTIONS: { id: MoneyPrazo; label: string; days: number }[] = [
  { id: "30_dias", label: "30 dias", days: 30 },
  { id: "90_dias", label: "90 dias", days: 90 },
  { id: "6_meses", label: "6 meses", days: 180 },
  { id: "1_ano", label: "1 ano", days: 365 },
];

export const MONEY_META_OPTIONS = [5000, 20000, 50000, 100000] as const;

export const MONEY_META_OPTIONS_BY_CURRENCY: Record<CreatorCurrency, readonly number[]> = {
  BRL: [5000, 20000, 50000, 100000],
  USD: [1000, 5000, 10000, 25000],
  EUR: [1000, 5000, 10000, 25000],
  GBP: [1000, 5000, 10000, 20000],
  CAD: [1500, 7500, 15000, 30000],
};

export function getMoneyMetaOptions(currency: CreatorCurrency = "BRL") {
  return MONEY_META_OPTIONS_BY_CURRENCY[currency] ?? MONEY_META_OPTIONS_BY_CURRENCY.BRL;
}

export function formatMoneyValue(value: number, currency: CreatorCurrency = "BRL") {
  return formatCreatorMoney(value, { currency });
}

export const MONEY_PRIORIDADE_OPTIONS: { id: MoneyPrioridade; label: string; desc: string }[] = [
  { id: "seguranca", label: "Segurança", desc: "Renda estável e previsível" },
  { id: "crescimento", label: "Crescimento", desc: "Escalar receita com equilíbrio" },
  { id: "escala", label: "Escala", desc: "Maximizar retorno e velocidade" },
];

export type GeneratedMoneyPlan = {
  plano_financeiro: string;
  produtos_recomendados: string[];
  servicos_recomendados: string[];
  receita_estimada: number;
  investimento_necessario: number;
  roi_estimado: number;
  riscos: string[];
  probabilidade_sucesso: number;
  cronograma: { semana: number; foco: string; tarefas: string[] }[];
  missoes_diarias: { titulo: string; descricao: string }[];
};

export type MoneyDashboardMetrics = {
  valorMeta: number;
  valorConquistado: number;
  valorRestante: number;
  diasRestantes: number;
  probabilidadeSucesso: number;
  progressoPct: number;
  planoAtivo: boolean;
  tituloPlano: string;
};

export const MONEY_AI_CONTEXT = `Você é a Aura Money Missions — transforma metas financeiras em planos executáveis.
Analise Legado, Creator, Research, CopyLab, Launch, Financeiro, Metas, Social Media e Alvesz Experience.
Gere planos práticos com produtos, serviços, receita, investimento, ROI, riscos e cronograma semanal.
Metas e valores na moeda escolhida (BRL, USD, EUR, GBP ou CAD).
Nunca assuma orçamento padrão — use apenas o "Orçamento disponível" informado pelo usuário.
Tom executivo, orientado a ação.`;

export const MONEY_IA_ACTIONS = [
  {
    id: "criar-plano",
    label: "Criar plano",
    prompt: "Analise meu perfil e crie um plano para atingir minha meta financeira.",
  },
  {
    id: "melhor-oportunidade",
    label: "Melhor oportunidade",
    prompt: "Qual é minha melhor oportunidade de ganhar dinheiro agora?",
  },
  {
    id: "fazer-hoje",
    label: "O que fazer hoje",
    prompt: "O que devo fazer hoje para avançar na meta?",
  },
] as const;

const MONEY_EARN_PHRASES = [
  "como ganho",
  "como ganhar",
  "quero ganhar",
  "preciso ganhar",
] as const;

const MONEY_TODAY_PHRASES = [
  "o que devo fazer hoje",
  "o que fazer hoje",
  "fazer hoje",
  "missao de hoje",
  "missao do dia",
] as const;

const MONEY_OPPORTUNITY_PHRASES = [
  "melhor oportunidade",
  "qual oportunidade",
  "onde ganhar",
  "como monetizar",
] as const;

const MONEY_LATE_PHRASES = [
  "missao atrasada",
  "missao esta atrasada",
  "tarefa atrasada",
  "o que esta atrasado",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export type MoneyCoachMode =
  | "money-earn"
  | "money-today"
  | "money-opportunity"
  | "money-late";

export function detectMoneyCoachMode(message: string): MoneyCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, MONEY_LATE_PHRASES)) return "money-late";
  if (matchesAny(normalized, MONEY_TODAY_PHRASES)) return "money-today";
  if (matchesAny(normalized, MONEY_OPPORTUNITY_PHRASES)) return "money-opportunity";
  if (
    matchesAny(normalized, MONEY_EARN_PHRASES) &&
    (normalized.includes("r$") ||
      normalized.includes("reais") ||
      /\d{3,}/.test(normalized))
  ) {
    return "money-earn";
  }
  return null;
}

export function resolvePrazoDays(prazo: MoneyPrazo): number {
  return MONEY_PRAZO_OPTIONS.find((p) => p.id === prazo)?.days ?? 90;
}

export function resolvePrazoLabel(prazo: MoneyPrazo): string {
  return MONEY_PRAZO_OPTIONS.find((p) => p.id === prazo)?.label ?? prazo;
}

export function resolvePrioridadeLabel(prioridade: MoneyPrioridade): string {
  return MONEY_PRIORIDADE_OPTIONS.find((p) => p.id === prioridade)?.label ?? prioridade;
}

export function computeDataFim(dataInicio: string, prazo: MoneyPrazo): string {
  const days = resolvePrazoDays(prazo);
  const start = new Date(`${dataInicio}T12:00:00`);
  start.setDate(start.getDate() + days);
  return start.toISOString().slice(0, 10);
}

export function computeDiasRestantes(dataFim: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${dataFim}T12:00:00`);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function parseCronograma(value: unknown): GeneratedMoneyPlan["cronograma"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is GeneratedMoneyPlan["cronograma"][number] => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { semana?: unknown }).semana === "number" &&
        typeof (item as { foco?: unknown }).foco === "string" &&
        Array.isArray((item as { tarefas?: unknown }).tarefas)
      );
    })
    .map((item) => ({
      semana: item.semana,
      foco: item.foco,
      tarefas: item.tarefas.filter((t): t is string => typeof t === "string"),
    }));
}

export function computeMoneyDashboard(
  plan: MoneyMissionPlan | null,
  tasks: MoneyMissionTask[]
): MoneyDashboardMetrics {
  if (!plan) {
    return {
      valorMeta: 0,
      valorConquistado: 0,
      valorRestante: 0,
      diasRestantes: 0,
      probabilidadeSucesso: 0,
      progressoPct: 0,
      planoAtivo: false,
      tituloPlano: "",
    };
  }

  const valorMeta = Number(plan.valor_meta);
  const valorConquistado = Number(plan.valor_conquistado);
  const valorRestante = Math.max(0, valorMeta - valorConquistado);
  const diasRestantes = computeDiasRestantes(plan.data_fim);
  const progressoPct =
    valorMeta > 0 ? Math.min(100, Math.round((valorConquistado / valorMeta) * 100)) : 0;

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const taskScore =
    tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const timeScore =
    diasRestantes > 0
      ? Math.min(100, Math.round((progressoPct / Math.max(1, 100 - (diasRestantes / resolvePrazoDays(plan.prazo as MoneyPrazo)) * 100)) * 50))
      : progressoPct >= 100
        ? 100
        : 20;

  const probabilidadeSucesso =
    plan.probabilidade_sucesso ??
    Math.round((taskScore * 0.4 + timeScore * 0.3 + progressoPct * 0.3));

  return {
    valorMeta,
    valorConquistado,
    valorRestante,
    diasRestantes,
    probabilidadeSucesso,
    progressoPct,
    planoAtivo: plan.status === "active",
    tituloPlano: `Ganhar ${formatBRL(valorMeta)} em ${resolvePrazoLabel(plan.prazo as MoneyPrazo)}`,
  };
}

export function getTodayMissions(tasks: MoneyMissionTask[]): MoneyMissionTask[] {
  const today = new Date().toISOString().slice(0, 10);
  return tasks
    .filter((t) => t.tipo === "diaria" && t.mission_date === today)
    .sort((a, b) => a.ordem - b.ordem);
}

export function getWeeklyMissions(tasks: MoneyMissionTask[]): MoneyMissionTask[] {
  return tasks
    .filter((t) => t.tipo === "semanal")
    .sort((a, b) => (a.semana ?? 0) - (b.semana ?? 0) || a.ordem - b.ordem);
}

export function getOverdueMissions(tasks: MoneyMissionTask[]): MoneyMissionTask[] {
  const today = new Date().toISOString().slice(0, 10);
  return tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.mission_date &&
      t.mission_date < today
  );
}

export function buildMoneyAuraContext(
  plan: MoneyMissionPlan | null,
  tasks: MoneyMissionTask[],
  dashboard: MoneyDashboardMetrics
): string {
  if (!plan) return "Nenhum plano financeiro ativo.";

  const cronograma = parseCronograma(plan.cronograma);
  const riscos = parseJsonStringArray(plan.riscos);
  const produtos = parseJsonStringArray(plan.produtos_recomendados);
  const servicos = parseJsonStringArray(plan.servicos_recomendados);
  const todayMissions = getTodayMissions(tasks);
  const overdue = getOverdueMissions(tasks);

  const lines = [
    `### Meta: ${formatBRL(dashboard.valorMeta)} em ${resolvePrazoLabel(plan.prazo as MoneyPrazo)}`,
    `Prioridade: ${resolvePrioridadeLabel(plan.prioridade as MoneyPrioridade)}`,
    `Progresso: ${formatBRL(dashboard.valorConquistado)} / ${formatBRL(dashboard.valorMeta)} (${dashboard.progressoPct}%)`,
    `Dias restantes: ${dashboard.diasRestantes}`,
    `Probabilidade de sucesso: ${dashboard.probabilidadeSucesso}%`,
    plan.plano_financeiro ? `\nPlano:\n${plan.plano_financeiro}` : "",
    produtos.length ? `\nProdutos: ${produtos.join("; ")}` : "",
    servicos.length ? `Serviços: ${servicos.join("; ")}` : "",
    plan.receita_estimada ? `Receita estimada: ${formatBRL(Number(plan.receita_estimada))}` : "",
    plan.orcamento_disponivel
      ? `Orçamento disponível: ${formatBRL(Number(plan.orcamento_disponivel))}`
      : "",
    plan.investimento_necessario
      ? `Investimento: ${formatBRL(Number(plan.investimento_necessario))}`
      : "",
    plan.roi_estimado ? `ROI: ${plan.roi_estimado}%` : "",
    riscos.length ? `Riscos: ${riscos.join("; ")}` : "",
    cronograma.length
      ? `\nCronograma:\n${cronograma.map((s) => `Semana ${s.semana}: ${s.foco}`).join("\n")}`
      : "",
    todayMissions.length
      ? `\nMissões de hoje:\n${todayMissions.map((m) => `• ${m.titulo}`).join("\n")}`
      : "",
    overdue.length
      ? `\nMissões atrasadas:\n${overdue.map((m) => `• ${m.titulo}`).join("\n")}`
      : "",
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildMoneyCoachReply(params: {
  mode: MoneyCoachMode;
  displayName: string;
  plan: MoneyMissionPlan | null;
  tasks: MoneyMissionTask[];
  dashboard: MoneyDashboardMetrics;
  message?: string;
}): string {
  const { mode, displayName, plan, tasks, dashboard, message } = params;
  const firstName = displayName.split(" ")[0] ?? displayName;

  if (!plan) {
    return `${firstName}, você ainda não tem um plano financeiro ativo. Acesse **Aura Money Missions** em /dashboard/money, defina quanto quer ganhar e deixe a IA montar seu plano executável.`;
  }

  const todayMissions = getTodayMissions(tasks);
  const overdue = getOverdueMissions(tasks);
  const weekly = getWeeklyMissions(tasks).filter((t) => t.status === "pending").slice(0, 3);
  const produtos = parseJsonStringArray(plan.produtos_recomendados);

  switch (mode) {
    case "money-earn": {
      const amountMatch = message?.match(/[\d.,]+/);
      const target = amountMatch
        ? formatBRL(Number(amountMatch[0].replace(/\./g, "").replace(",", ".")))
        : formatBRL(dashboard.valorMeta);
      return `${firstName}, para ganhar ${target}:

**Seu plano atual:** ${dashboard.tituloPlano}
**Progresso:** ${formatBRL(dashboard.valorConquistado)} de ${formatBRL(dashboard.valorMeta)} (${dashboard.progressoPct}%)

**Caminho recomendado:**
${plan.plano_financeiro?.slice(0, 400) ?? "Acesse Money Missions para ver o plano completo."}

**Produtos sugeridos:** ${produtos.slice(0, 3).join(", ") || "—"}
**Investimento:** ${plan.investimento_necessario ? formatBRL(Number(plan.investimento_necessario)) : "—"}
**ROI estimado:** ${plan.roi_estimado ?? "—"}%

Próximo passo: ${weekly[0]?.titulo ?? todayMissions[0]?.titulo ?? "Criar ou revisar seu plano no Money Missions."}`;
    }

    case "money-today":
      if (todayMissions.length === 0) {
        return `${firstName}, não há missões diárias para hoje. Foque nas tarefas da semana:\n${weekly.map((m) => `• ${m.titulo}`).join("\n") || "• Revise seu plano em /dashboard/money"}`;
      }
      return `${firstName}, suas missões de hoje (${dashboard.diasRestantes} dias restantes, ${dashboard.progressoPct}% da meta):

${todayMissions.map((m, i) => `${i + 1}. **${m.titulo}** — ${m.descricao}`).join("\n")}

Faltam ${formatBRL(dashboard.valorRestante)} para a meta. Probabilidade de sucesso: ${dashboard.probabilidadeSucesso}%.`;

    case "money-opportunity":
      return `${firstName}, sua melhor oportunidade agora:

**Produtos:** ${produtos.slice(0, 3).join(", ") || "Crie um produto no Creator"}
**Serviços:** ${parseJsonStringArray(plan.servicos_recomendados).slice(0, 2).join(", ") || "—"}
**Receita estimada:** ${plan.receita_estimada ? formatBRL(Number(plan.receita_estimada)) : "—"}

${weekly[0] ? `Ação imediata: **${weekly[0].titulo}**` : "Defina um plano em Money Missions para desbloquear recomendações personalizadas."}`;

    case "money-late":
      if (overdue.length === 0) {
        return `${firstName}, nenhuma missão atrasada. Continue com: ${todayMissions[0]?.titulo ?? weekly[0]?.titulo ?? "revisar seu plano semanal"}.`;
      }
      return `${firstName}, você tem ${overdue.length} missão(ões) atrasada(s):

${overdue.slice(0, 5).map((m) => `• **${m.titulo}** (prevista ${m.mission_date})`).join("\n")}

Priorize estas para manter a probabilidade de sucesso em ${dashboard.probabilidadeSucesso}%.`;

    default:
      return `${firstName}, acesse /dashboard/money para gerenciar suas missões financeiras.`;
  }
}

export function getMoneyMissionXpAcao(missionKey: string): string | null {
  if (missionKey.startsWith("semana-")) return "missao_money_concluir";
  if (missionKey.startsWith("diaria-")) return "missao_money_concluir";
  return "missao_money_concluir";
}
