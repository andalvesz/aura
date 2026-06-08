import type {
  AiMemory,
  AlveszEvento,
  Conteudo,
  Evento,
  FinancialBalance,
  FinancialGoal,
  FinancialIncome,
  Gasto,
  Goal,
  GrowthGoal,
  GrowthLead,
  HealthHabit,
  HealthWorkout,
  LanguageLesson,
  LanguageProgress,
  LanguageSession,
  Notification,
} from "@/types/database";
import type { AuraXpState } from "@/lib/supabase/services/xp.service";
import type { AuraGlobalSummaryData } from "@/utils/mentor";
import { formatBRL, formatDate, formatTime } from "@/utils/format";
import {
  computeGrowthLeadMetrics,
  getCurrentGoal,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";
import {
  computeSmartFinanceStats,
  filterIncomeCurrentMonth,
  getActiveFinancialGoal,
} from "@/utils/finance";
import { filterUpcomingEventos } from "@/utils/nexus";
import { normalizeConteudoStatus } from "@/utils/social";
import { todayIsoDate } from "@/utils/health";
import { AI_MEMORY_CATEGORY_LABELS } from "@/utils/aura-memory";
import { truncatePreview } from "@/utils/memory";
import { buildLanguageReportLines } from "@/utils/english";
import { buildGoalsSummaryLines } from "@/utils/goals";

export type ExecutiveReportType = "daily" | "weekly" | "monthly";

export type ExecutiveReportPdfMeta = {
  ready: boolean;
  version: number;
  templateId: string;
  reportType?: ExecutiveReportType;
  generatedAt?: string;
};

export const DEFAULT_EXECUTIVE_REPORT_PDF_META: ExecutiveReportPdfMeta = {
  ready: false,
  version: 1,
  templateId: "executive-report-v1",
};

export type ExecutiveReportAnalysis = {
  funcionou: string;
  naoFuncionou: string;
  maiorOportunidade: string;
  maiorRisco: string;
  proximaPrioridade: string;
};

export type ExecutiveReportPayload = {
  type: ExecutiveReportType;
  title: string;
  text: string;
  sections: { label: string; lines: string[] }[];
  pdfMeta: ExecutiveReportPdfMeta;
  generatedAt: string;
};

export type ExecutiveReportData = AuraGlobalSummaryData & {
  financialIncome: FinancialIncome[];
  financialGoals: FinancialGoal[];
  financialBalance: FinancialBalance | null;
  alveszEventos: AlveszEvento[];
  weekMemories: AiMemory[];
  goals: Goal[];
  auraXp: AuraXpState | null;
  notifications: Notification[];
  languageProgress: LanguageProgress | null;
  languageSessions: LanguageSession[];
  languageLessons: LanguageLesson[];
};

export function formatReportGreeting(name = "você"): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Bom dia ${name}.`;
  if (hour < 18) return `Boa tarde ${name}.`;
  return `Boa noite ${name}.`;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getWeekRange(reference = new Date()): { start: string; end: string } {
  const end = new Date(reference);
  const start = new Date(reference);
  start.setDate(start.getDate() - 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getMonthRange(reference = new Date()): { start: string; end: string } {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function isInDateRange(
  iso: string | null | undefined,
  start: string,
  end: string
): boolean {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= start && d <= end;
}

function sumIncomeInRange(income: FinancialIncome[], start: string, end: string): number {
  return income
    .filter((i) => isInDateRange(i.data, start, end))
    .reduce((s, i) => s + Number(i.valor), 0);
}

function sumGastosInRange(gastos: Gasto[], start: string, end: string): number {
  return gastos
    .filter((g) => isInDateRange(g.data, start, end))
    .reduce((s, g) => s + Number(g.valor), 0);
}

export function hasWeeklyReportData(data: ExecutiveReportData): boolean {
  const { start, end } = getWeekRange();
  const weekIncome = sumIncomeInRange(data.financialIncome, start, end);
  const weekExpenses = sumGastosInRange(data.gastos, start, end);
  const leadsCreated = data.leads.filter((l) =>
    isInDateRange(l.created_at, start, end)
  ).length;
  const leadsClosed = data.leads.filter(
    (l) => l.status === "fechado" && isInDateRange(l.updated_at, start, end)
  ).length;
  const eventsDone = [
    ...data.eventos.filter((e) => isInDateRange(e.data_inicio, start, end)),
    ...data.alveszEventos.filter((e) => isInDateRange(e.data_evento, start, end)),
  ].length;
  const contentPublished = data.conteudos.filter(
    (c) =>
      normalizeConteudoStatus(c.status) === "publicado" &&
      isInDateRange(c.data_publicacao ?? c.updated_at, start, end)
  ).length;
  const workoutsDone = data.healthWorkouts.filter((w) =>
    isInDateRange(w.data, start, end)
  ).length;
  const habitsDone = data.healthHabits.filter(
    (h) => h.status === "concluido" && isInDateRange(h.data, start, end)
  ).length;
  const languageSessionsWeek = data.languageSessions.filter((s) =>
    isInDateRange(s.data, start, end)
  ).length;

  return (
    weekIncome > 0 ||
    weekExpenses > 0 ||
    leadsCreated > 0 ||
    leadsClosed > 0 ||
    eventsDone > 0 ||
    contentPublished > 0 ||
    workoutsDone > 0 ||
    habitsDone > 0 ||
    languageSessionsWeek > 0 ||
    data.weekMemories.length > 0
  );
}

function buildPdfMeta(type: ExecutiveReportType): ExecutiveReportPdfMeta {
  return {
    ...DEFAULT_EXECUTIVE_REPORT_PDF_META,
    reportType: type,
    generatedAt: new Date().toISOString(),
  };
}

function formatFinancialGoalLine(
  financialGoals: FinancialGoal[],
  growthGoal: GrowthGoal | null
): string {
  const finGoal = getActiveFinancialGoal(financialGoals);
  if (finGoal) {
    const meta = Number(finGoal.valor_meta);
    const atual = Number(finGoal.valor_atual);
    const pct = meta > 0 ? Math.round((atual / meta) * 100) : 0;
    return `${finGoal.titulo}: ${formatBRL(atual)} de ${formatBRL(meta)} (${pct}%)`;
  }
  if (growthGoal && growthGoal.meta_receita_mensal > 0) {
    const atual = growthGoal.receita_atual ?? 0;
    const meta = growthGoal.meta_receita_mensal;
    const pct = Math.round((atual / meta) * 100);
    return `Meta de crescimento: ${formatBRL(atual)} de ${formatBRL(meta)} (${pct}%)`;
  }
  return "Nenhuma meta financeira ativa — defina em Financeiro ou Crescimento.";
}

export function buildDailyExecutiveReport(
  data: ExecutiveReportData,
  displayName?: string
): ExecutiveReportPayload {
  const today = todayIsoDate();
  const priorityLeads = sortGrowthLeadOpportunities(
    data.leads.filter((l) => l.status !== "fechado" && l.status !== "perdido")
  ).slice(0, 5);

  const upcoming = filterUpcomingEventos(data.eventos, 14).slice(0, 5);
  const habitsPending = data.healthHabits.filter(
    (h) => h.data === today && h.status !== "concluido"
  );
  const contentPending = data.conteudos.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  );
  const growthGoal = data.goal ?? getCurrentGoal([]);

  const sections = [
    {
      label: "Leads prioritários",
      lines:
        priorityLeads.length > 0
          ? priorityLeads.map((l) => `${l.nome} — ${l.status}`)
          : ["Nenhum lead prioritário no momento."],
    },
    {
      label: "Próximos eventos",
      lines:
        upcoming.length > 0
          ? upcoming.map(
              (e) =>
                `${formatDate(e.data_inicio.slice(0, 10))} ${formatTime(e.data_inicio)} — ${e.titulo}`
            )
          : ["Nenhum evento nos próximos dias."],
    },
    {
      label: "Hábitos pendentes",
      lines:
        habitsPending.length > 0
          ? habitsPending.map((h) => h.titulo)
          : ["Todos os hábitos de hoje concluídos ou nenhum cadastrado."],
    },
    {
      label: "Conteúdos pendentes",
      lines:
        contentPending.length > 0
          ? [
              `${contentPending.length} conteúdo(s) pendente(s)`,
              ...contentPending.slice(0, 3).map((c) => c.titulo),
            ]
          : ["Nenhum conteúdo pendente."],
    },
    {
      label: "Meta financeira",
      lines: [formatFinancialGoalLine(data.financialGoals, growthGoal)],
    },
  ];

  const body = sections
    .map((s) => `${s.label}:\n${s.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");

  const text = `${formatReportGreeting(displayName)}\n\nHoje:\n\n${body}`;

  return {
    type: "daily",
    title: "Relatório diário",
    text,
    sections,
    pdfMeta: buildPdfMeta("daily"),
    generatedAt: new Date().toISOString(),
  };
}

export function buildWeeklyExecutiveReport(data: ExecutiveReportData): ExecutiveReportPayload {
  const { start, end } = getWeekRange();
  const weekIncome = sumIncomeInRange(data.financialIncome, start, end);
  const weekExpenses = sumGastosInRange(data.gastos, start, end);
  const leadsCreated = data.leads.filter((l) =>
    isInDateRange(l.created_at, start, end)
  ).length;
  const leadsClosed = data.leads.filter(
    (l) => l.status === "fechado" && isInDateRange(l.updated_at, start, end)
  ).length;
  const calendarEvents = data.eventos.filter((e) =>
    isInDateRange(e.data_inicio, start, end)
  ).length;
  const alveszEvents = data.alveszEventos.filter((e) =>
    isInDateRange(e.data_evento, start, end)
  ).length;
  const eventsDone = calendarEvents + alveszEvents;
  const contentPublished = data.conteudos.filter(
    (c) =>
      normalizeConteudoStatus(c.status) === "publicado" &&
      isInDateRange(c.data_publicacao ?? c.updated_at, start, end)
  ).length;
  const workoutsDone = data.healthWorkouts.filter((w) =>
    isInDateRange(w.data, start, end)
  ).length;
  const habitsDone = data.healthHabits.filter(
    (h) => h.status === "concluido" && isInDateRange(h.data, start, end)
  ).length;
  const orcamentosWeek = data.orcamentos.filter((o) =>
    isInDateRange(o.created_at, start, end)
  ).length;

  const memoryLines =
    data.weekMemories.length > 0
      ? data.weekMemories.slice(0, 5).map(
          (m) =>
            `${AI_MEMORY_CATEGORY_LABELS[m.categoria]} — ${m.titulo}: ${truncatePreview(m.conteudo, 100)}`
        )
      : ["Nenhuma memória registrada nesta semana."];

  const sections = [
    {
      label: "Financeiro",
      lines: [
        `Receitas da semana: ${formatBRL(weekIncome)}`,
        `Despesas da semana: ${formatBRL(weekExpenses)}`,
        `Saldo da semana: ${formatBRL(weekIncome - weekExpenses)}`,
      ],
    },
    {
      label: "Crescimento / CRM",
      lines: [
        `Leads criados: ${leadsCreated}`,
        `Leads fechados: ${leadsClosed}`,
      ],
    },
    {
      label: "Calendário",
      lines: [`Eventos realizados: ${calendarEvents}`],
    },
    {
      label: "Alvesz",
      lines: [
        `Eventos Alvesz: ${alveszEvents}`,
        `Orçamentos criados: ${orcamentosWeek}`,
      ],
    },
    {
      label: "Saúde",
      lines: [
        `Treinos realizados: ${workoutsDone}`,
        `Hábitos concluídos: ${habitsDone}`,
      ],
    },
    {
      label: "Social Media",
      lines: [`Conteúdos publicados: ${contentPublished}`],
    },
    {
      label: "Aura English Coach",
      lines: buildLanguageReportLines(
        data.languageProgress,
        data.languageSessions,
        data.languageLessons
      ),
    },
    {
      label: "Metas",
      lines: buildGoalsSummaryLines(data.goals),
    },
    {
      label: "Memória da Aura",
      lines: memoryLines,
    },
    {
      label: `Resumo (${formatDate(start)} – ${formatDate(end)})`,
      lines: [
        `Receitas: ${formatBRL(weekIncome)}`,
        `Despesas: ${formatBRL(weekExpenses)}`,
        `Leads criados: ${leadsCreated}`,
        `Leads fechados: ${leadsClosed}`,
        `Eventos realizados: ${eventsDone}`,
        `Conteúdos publicados: ${contentPublished}`,
        `Treinos realizados: ${workoutsDone}`,
        `Hábitos concluídos: ${habitsDone}`,
      ],
    },
  ];

  const text = `Relatório semanal — ${formatDate(start)} a ${formatDate(end)}\n\n${sections
    .filter((s) => s.label !== `Resumo (${formatDate(start)} – ${formatDate(end)})`)
    .map((s) => `${s.label}:\n${s.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n")}`;

  return {
    type: "weekly",
    title: "Relatório semanal",
    text,
    sections,
    pdfMeta: buildPdfMeta("weekly"),
    generatedAt: new Date().toISOString(),
  };
}

export function buildMonthlyExecutiveReport(data: ExecutiveReportData): ExecutiveReportPayload {
  const { start, end } = getMonthRange();
  const monthIncome = filterIncomeCurrentMonth(data.financialIncome);
  const receita = monthIncome.reduce((s, i) => s + Number(i.valor), 0);
  const metrics = computeGrowthLeadMetrics(data.leads);
  const growthGoal = data.goal ?? getCurrentGoal([]);
  const conversionPct =
    data.leads.length > 0
      ? Math.round((metrics.fechados / data.leads.length) * 100)
      : 0;
  const contentPublished = data.conteudos.filter(
    (c) =>
      normalizeConteudoStatus(c.status) === "publicado" &&
      isInDateRange(c.data_publicacao ?? c.updated_at, start, end)
  ).length;
  const contentTotal = data.conteudos.filter((c) =>
    isInDateRange(c.created_at, start, end)
  ).length;
  const workoutsMonth = data.healthWorkouts.filter((w) =>
    isInDateRange(w.data, start, end)
  ).length;
  const habitsMonth = data.healthHabits.filter(
    (h) => h.status === "concluido" && isInDateRange(h.data, start, end)
  ).length;
  const eventsMonth = [
    ...data.eventos.filter((e) => isInDateRange(e.data_inicio, start, end)),
    ...data.alveszEventos.filter((e) => isInDateRange(e.data_evento, start, end)),
  ].length;

  const financeStats = computeSmartFinanceStats({
    gastos: data.gastos,
    income: data.financialIncome,
    goals: data.financialGoals,
    initialBalance: data.financialBalance?.valor_atual ?? null,
  });

  const sections = [
    {
      label: "Receita",
      lines: [
        `Receitas no mês: ${formatBRL(receita)}`,
        financeStats.hasInitialBalance
          ? `Saldo atual: ${formatBRL(financeStats.saldoAtual ?? 0)}`
          : "Saldo atual: defina o saldo inicial no Financeiro",
        financeStats.hasInitialBalance
          ? `Previsão fim do mês: ${formatBRL(financeStats.projectedSaldo ?? 0)}`
          : "Previsão: indisponível sem saldo inicial",
      ],
    },
    {
      label: "Crescimento",
      lines: [
        growthGoal
          ? `Meta mensal: ${formatBRL(growthGoal.receita_atual ?? 0)} de ${formatBRL(growthGoal.meta_receita_mensal)}`
          : "Sem meta de crescimento definida.",
        `Leads ativos: ${metrics.ativos}`,
        `Pipeline potencial: ${formatBRL(metrics.receitaPotencial)}`,
      ],
    },
    {
      label: "Conversão",
      lines: [
        `Taxa de fechamento: ${conversionPct}% (${metrics.fechados}/${data.leads.length} leads)`,
        `Fechados no mês: ${data.leads.filter((l) => l.status === "fechado" && isInDateRange(l.updated_at, start, end)).length}`,
      ],
    },
    {
      label: "Conteúdo",
      lines: [
        `Publicados no mês: ${contentPublished}`,
        `Planejados/criados: ${contentTotal}`,
      ],
    },
    {
      label: "Saúde",
      lines: [
        `Treinos registrados: ${workoutsMonth}`,
        `Hábitos concluídos: ${habitsMonth}`,
      ],
    },
    {
      label: "Eventos",
      lines: [`Eventos no mês: ${eventsMonth}`],
    },
  ];

  const text = `Relatório mensal — ${formatDate(start)} a ${formatDate(end)}\n\n${sections
    .map((s) => `${s.label}:\n${s.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n")}`;

  return {
    type: "monthly",
    title: "Relatório mensal",
    text,
    sections,
    pdfMeta: buildPdfMeta("monthly"),
    generatedAt: new Date().toISOString(),
  };
}

export function buildExecutiveReport(
  type: ExecutiveReportType,
  data: ExecutiveReportData,
  displayName?: string
): ExecutiveReportPayload {
  switch (type) {
    case "weekly":
      return buildWeeklyExecutiveReport(data);
    case "monthly":
      return buildMonthlyExecutiveReport(data);
    default:
      return buildDailyExecutiveReport(data, displayName);
  }
}

export function buildReportAnalysisFallback(
  report: ExecutiveReportPayload,
  data: ExecutiveReportData
): ExecutiveReportAnalysis {
  const metrics = computeGrowthLeadMetrics(data.leads);
  const topLead = sortGrowthLeadOpportunities(data.leads)[0];
  const pendingContent = data.conteudos.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  );

  const funcionou: string[] = [];
  const naoFuncionou: string[] = [];

  if (report.type === "weekly") {
    const crmSection = report.sections.find((s) => s.label.includes("Crescimento"));
    const closedLine = crmSection?.lines.find((l) => l.startsWith("Leads fechados"));
    if (closedLine && !closedLine.endsWith(": 0")) funcionou.push("Fechamentos na semana.");
    else naoFuncionou.push("Sem fechamentos na semana — reforçar follow-up.");

    const financeSection = report.sections.find((s) => s.label === "Financeiro");
    const incomeLine = financeSection?.lines.find((l) => l.startsWith("Receitas"));
    if (incomeLine && !incomeLine.includes("R$ 0,00")) {
      funcionou.push("Receitas registradas na semana.");
    }
  }

  if (metrics.fechados > 0) funcionou.push(`${metrics.fechados} lead(s) fechado(s) no CRM.`);
  if (pendingContent.length > 3) {
    naoFuncionou.push(`${pendingContent.length} conteúdos pendentes acumulados.`);
  }
  if (metrics.ativos === 0) {
    naoFuncionou.push("Pipeline vazio — cadastre novos leads.");
  }

  return {
    funcionou:
      funcionou.length > 0
        ? funcionou.join(" ")
        : "Mantenha o ritmo de cadastro e execução diária.",
    naoFuncionou:
      naoFuncionou.length > 0
        ? naoFuncionou.join(" ")
        : "Nenhum ponto crítico identificado nos dados atuais.",
    maiorOportunidade: topLead
      ? `Priorizar ${topLead.nome} (${formatBRL(topLead.valor_potencial ?? 0)}).`
      : "Captar novos leads no Crescimento e Alvesz.",
    maiorRisco:
      pendingContent.length > 0 && metrics.ativos > 0
        ? "Conteúdo atrasado pode esfriar o funil comercial."
        : "Baixa atividade registrada nos módulos.",
    proximaPrioridade:
      report.type === "daily"
        ? report.sections[0]?.lines[0] ?? "Definir meta e primeiro lead do dia."
        : topLead
          ? `Follow-up com ${topLead.nome} hoje.`
          : "Cadastrar lead e agendar conteúdo da semana.",
  };
}

export function formatReportWithAnalysis(
  report: ExecutiveReportPayload,
  analysis: ExecutiveReportAnalysis
): string {
  return `${report.text}

———
Análise Aura Central

O que funcionou
- ${analysis.funcionou}

O que não funcionou
- ${analysis.naoFuncionou}

Maior oportunidade
- ${analysis.maiorOportunidade}

Maior risco
- ${analysis.maiorRisco}

Próxima prioridade
- ${analysis.proximaPrioridade}`;
}

export function isExecutiveReportQuery(message: string): ExecutiveReportType | null {
  const n = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (n.includes("relatorio diario") || n.includes("relatorio do dia")) return "daily";
  if (n.includes("relatorio semanal") || n.includes("resumo da semana")) return "weekly";
  if (n.includes("relatorio mensal") || n.includes("resumo do mes")) return "monthly";
  return null;
}
