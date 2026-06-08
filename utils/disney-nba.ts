import type {
  Evento,
  FinancialGoal,
  Goal,
  Gasto,
  LanguageLesson,
  LanguageProgress,
  LanguageSession,
  Trip,
  TripChecklistItem,
} from "@/types/database";
import { formatBRL, formatDate, formatTime } from "@/utils/format";
import {
  buildLanguageReportLines,
  computeWeeklyLanguageStats,
  getEnglishModoLabel,
  getStreakEmoji,
} from "@/utils/english";
import {
  computeChecklistProgress,
  daysUntilTrip,
  formatTripDateRange,
  sumViagemGastos,
} from "@/utils/travel";
import { getTravelTemplate } from "@/utils/travel-templates";

export const DISNEY_NBA_TEMPLATE_ID = "disney-nba";

export const DISNEY_NBA_AI_PROMPTS = [
  {
    id: "semana",
    label: "O que devo fazer esta semana?",
    message:
      "Com base nos meus dados reais da viagem Disney + NBA, o que devo priorizar esta semana? Liste ações concretas e ordenadas.",
  },
  {
    id: "orcamento",
    label: "Estou dentro do orçamento?",
    message:
      "Analise meu orçamento, economia acumulada e meta mensal da viagem Disney + NBA. Estou no caminho certo? O que ajustar?",
  },
  {
    id: "ingles",
    label: "Meu inglês está evoluindo?",
    message:
      "Avalie meu progresso de inglês para a viagem Disney + NBA. Estou evoluindo bem? O que praticar agora?",
  },
  {
    id: "faltando",
    label: "O que falta para a viagem?",
    message:
      "Liste tudo que ainda falta para minha viagem Disney + NBA: documentos, checklist, finanças, inglês e calendário.",
  },
] as const;

export type DisneyNbaAiPromptId = (typeof DISNEY_NBA_AI_PROMPTS)[number]["id"];

export type DisneyNbaChecklistStatus = {
  categoria: string;
  label: string;
  total: number;
  done: number;
  pct: number;
  items: TripChecklistItem[];
};

export type DisneyNbaDashboard = {
  trip: Trip | null;
  daysUntil: number | null;
  requiredAmount: number;
  accumulatedAmount: number;
  monthlyTarget: number;
  monthsRemaining: number;
  savingsPct: number;
  checklistPct: number;
  checklistTotal: number;
  checklistDone: number;
  checklistByCategory: DisneyNbaChecklistStatus[];
  englishStreak: number;
  englishWeeklySessions: number;
  englishWeeklyLessons: number;
  englishWeeklyMinutes: number;
  englishProgressPct: number;
  upcomingEvents: Evento[];
  tripGastos: number;
  onBudget: boolean;
};

const SAVINGS_KEYWORDS = ["disney", "nba", "orlando", "viagem", "travel"];

function matchesSavingsKeyword(text: string): boolean {
  const n = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SAVINGS_KEYWORDS.some((k) => n.includes(k));
}

export function isDisneyNbaTrip(trip: Trip): boolean {
  if (trip.template_id === DISNEY_NBA_TEMPLATE_ID) return true;
  const blob = `${trip.nome} ${trip.destino}`.toLowerCase();
  return blob.includes("disney") || blob.includes("nba") || blob.includes("orlando");
}

export function findDisneyNbaTrip(trips: Trip[]): Trip | null {
  const disneyTrips = trips.filter(isDisneyNbaTrip);
  if (!disneyTrips.length) return null;

  const active = disneyTrips.filter(
    (t) => t.status !== "cancelada" && t.status !== "concluida"
  );
  const pool = active.length ? active : disneyTrips;

  return pool
    .slice()
    .sort((a, b) => {
      const da = daysUntilTrip(a);
      const db = daysUntilTrip(b);
      if (da >= 0 && db >= 0) return a.data_ida.localeCompare(b.data_ida);
      if (da >= 0) return -1;
      if (db >= 0) return 1;
      return b.data_ida.localeCompare(a.data_ida);
    })[0];
}

export function resolveTripSavings(
  goals: Goal[],
  financialGoals: FinancialGoal[],
  trip: Trip | null
): number {
  const candidates: number[] = [];

  for (const goal of goals) {
    if (goal.tipo !== "financeira" && goal.tipo !== "personalizada") continue;
    if (matchesSavingsKeyword(goal.titulo)) {
      candidates.push(Number(goal.atual));
    }
  }

  for (const goal of financialGoals) {
    if (matchesSavingsKeyword(goal.titulo)) {
      candidates.push(Number(goal.valor_atual));
    }
  }

  if (trip && candidates.length === 0) {
    candidates.push(Math.max(0, Number(trip.gasto_atual)));
  }

  return candidates.length ? Math.max(...candidates) : 0;
}

export function monthsUntilDate(isoDate: string, reference = new Date()): number {
  const target = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  const ref = new Date(reference);
  const months =
    (target.getFullYear() - ref.getFullYear()) * 12 +
    (target.getMonth() - ref.getMonth());
  const dayAdjust = target.getDate() < ref.getDate() ? 0 : 1;
  return Math.max(1, months + dayAdjust);
}

export function computeMonthlySavingsTarget(
  required: number,
  accumulated: number,
  tripDate: string,
  reference = new Date()
): { monthlyTarget: number; monthsRemaining: number } {
  const remaining = Math.max(0, required - accumulated);
  const monthsRemaining = monthsUntilDate(tripDate, reference);
  return {
    monthlyTarget: Math.ceil(remaining / monthsRemaining),
    monthsRemaining,
  };
}

export function getChecklistCategoryStatus(
  checklist: TripChecklistItem[],
  categoria: TripChecklistItem["categoria"],
  label: string
): DisneyNbaChecklistStatus {
  const items = checklist.filter((i) => i.categoria === categoria);
  const done = items.filter((i) => i.status === "feito").length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { categoria, label, total, done, pct, items };
}

export function filterTripEventos(eventos: Evento[], trip: Trip | null): Evento[] {
  if (!trip) return [];

  const today = new Date().toISOString();
  return eventos
    .filter((e) => {
      if (e.tipo !== "viagem") return false;
      const start = e.data_inicio.slice(0, 10);
      if (start < trip.data_ida || start > trip.data_volta) return false;
      return e.data_inicio >= today;
    })
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
    .slice(0, 8);
}

export function computeEnglishTripProgress(
  progress: LanguageProgress | null,
  sessions: LanguageSession[],
  lessons: LanguageLesson[]
): {
  streak: number;
  weekly: ReturnType<typeof computeWeeklyLanguageStats>;
  disneyNbaSessions: number;
  progressPct: number;
} {
  const disneyNbaSessions = sessions.filter(
    (s) => s.modo === "disney" || s.modo === "nba" || s.modo === "viagens"
  ).length;

  const weekly = computeWeeklyLanguageStats(sessions, lessons);
  const modules = progress?.modulos_concluidos ?? 0;
  const lessonsDone = progress?.aulas_concluidas ?? 0;
  const exercises = progress?.exercicios_concluidos ?? 0;
  const progressPct = Math.min(
    100,
    Math.round((modules * 15 + lessonsDone * 5 + exercises * 2 + disneyNbaSessions) / 2)
  );

  return {
    streak: progress?.streak_dias ?? 0,
    weekly,
    disneyNbaSessions,
    progressPct,
  };
}

export function computeDisneyNbaDashboard(input: {
  trips: Trip[];
  checklist: TripChecklistItem[];
  goals: Goal[];
  financialGoals: FinancialGoal[];
  gastos: Gasto[];
  eventos: Evento[];
  languageProgress: LanguageProgress | null;
  languageSessions: LanguageSession[];
  languageLessons: LanguageLesson[];
  reference?: Date;
}): DisneyNbaDashboard {
  const reference = input.reference ?? new Date();
  const trip = findDisneyNbaTrip(input.trips);
  const template = getTravelTemplate(DISNEY_NBA_TEMPLATE_ID);

  const requiredAmount = trip?.orcamento || template?.orcamentoSugerido || 0;
  const accumulatedAmount = resolveTripSavings(
    input.goals,
    input.financialGoals,
    trip
  );

  const tripDate = trip?.data_ida ?? addMonthsIso(reference, 12);
  const { monthlyTarget, monthsRemaining } = computeMonthlySavingsTarget(
    requiredAmount,
    accumulatedAmount,
    tripDate,
    reference
  );

  const savingsPct =
    requiredAmount > 0
      ? Math.min(100, Math.round((accumulatedAmount / requiredAmount) * 100))
      : 0;

  const checklistPct = computeChecklistProgress(input.checklist);
  const checklistDone = input.checklist.filter((i) => i.status === "feito").length;
  const checklistTotal = input.checklist.length;

  const checklistByCategory: DisneyNbaChecklistStatus[] = [
    getChecklistCategoryStatus(input.checklist, "passaporte", "Passaporte"),
    getChecklistCategoryStatus(input.checklist, "visto", "Visto"),
    getChecklistCategoryStatus(input.checklist, "hospedagem", "Hospedagem"),
    getChecklistCategoryStatus(input.checklist, "ingressos", "Ingressos"),
  ];

  const english = computeEnglishTripProgress(
    input.languageProgress,
    input.languageSessions,
    input.languageLessons
  );

  const tripGastos = trip ? sumViagemGastos(input.gastos, trip) : 0;
  const daysUntil = trip ? daysUntilTrip(trip, reference) : null;

  const expectedSavings =
    monthsRemaining > 0
      ? (accumulatedAmount / Math.max(1, 12 - monthsRemaining + 1))
      : accumulatedAmount;
  const onBudget =
    requiredAmount <= 0 ||
    accumulatedAmount >= requiredAmount * 0.9 ||
    accumulatedAmount >= expectedSavings;

  return {
    trip,
    daysUntil,
    requiredAmount,
    accumulatedAmount,
    monthlyTarget,
    monthsRemaining,
    savingsPct,
    checklistPct,
    checklistTotal,
    checklistDone,
    checklistByCategory,
    englishStreak: english.streak,
    englishWeeklySessions: english.weekly.sessoes,
    englishWeeklyLessons: english.weekly.aulasConcluidas,
    englishWeeklyMinutes: english.weekly.minutosEstudo,
    englishProgressPct: english.progressPct,
    upcomingEvents: filterTripEventos(input.eventos, trip),
    tripGastos,
    onBudget,
  };
}

function addMonthsIso(reference: Date, months: number): string {
  const d = new Date(reference);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function buildDisneyNbaAiContext(dashboard: DisneyNbaDashboard): string {
  const { trip } = dashboard;
  const template = getTravelTemplate(DISNEY_NBA_TEMPLATE_ID);

  const tripBlock = trip
    ? `Viagem: ${trip.nome}
Destino: ${trip.destino}
Datas: ${formatTripDateRange(trip)}
Status: ${trip.status}
Dias restantes: ${dashboard.daysUntil ?? "—"}
Orçamento viagem: ${formatBRL(trip.orcamento)}`
    : "Nenhuma viagem Disney + NBA cadastrada ainda.";

  const financeBlock = `Valor necessário: ${formatBRL(dashboard.requiredAmount)}
Valor acumulado: ${formatBRL(dashboard.accumulatedAmount)} (${dashboard.savingsPct}%)
Meta mensal sugerida: ${formatBRL(dashboard.monthlyTarget)} (${dashboard.monthsRemaining} meses restantes)
Gastos registrados (categoria viagem): ${formatBRL(dashboard.tripGastos)}
Dentro do orçamento (heurística): ${dashboard.onBudget ? "sim" : "atenção"}`;

  const checklistBlock =
    dashboard.checklistTotal > 0
      ? `Checklist geral: ${dashboard.checklistDone}/${dashboard.checklistTotal} (${dashboard.checklistPct}%)
${dashboard.checklistByCategory
  .map(
    (c) =>
      `- ${c.label}: ${c.done}/${c.total} (${c.pct}%)${c.items
        .filter((i) => i.status !== "feito")
        .map((i) => `\n  pendente: ${i.titulo}`)
        .join("")}`
  )
  .join("\n")}`
      : "Checklist vazio — criar viagem com template disney-nba.";

  const englishBlock = `Streak: ${dashboard.englishStreak} dias
Sessões na semana: ${dashboard.englishWeeklySessions}
Aulas concluídas na semana: ${dashboard.englishWeeklyLessons}
Minutos de estudo na semana: ${dashboard.englishWeeklyMinutes}
Progresso estimado para viagem: ${dashboard.englishProgressPct}%`;

  const eventsBlock =
    dashboard.upcomingEvents.length > 0
      ? dashboard.upcomingEvents
          .map(
            (e) =>
              `- ${formatDate(e.data_inicio)} ${formatTime(e.data_inicio)}: ${e.titulo}${e.local ? ` (${e.local})` : ""}`
          )
          .join("\n")
      : "Nenhum evento futuro da viagem no calendário.";

  return `## CENTRAL DISNEY + NBA — DADOS REAIS

### Viagem
${tripBlock}

### Template de referência
${template?.label ?? "Disney + NBA"} — orçamento sugerido ${formatBRL(template?.orcamentoSugerido ?? 0)}

### Finanças
${financeBlock}

### Checklist
${checklistBlock}

### Inglês (Disney / NBA / viagens)
${englishBlock}

### Próximos eventos da viagem
${eventsBlock}`;
}

export function formatCountdown(daysUntil: number | null): string {
  if (daysUntil === null) return "—";
  if (daysUntil < 0) return "Viagem encerrada";
  if (daysUntil === 0) return "É hoje!";
  return `${daysUntil} dias`;
}

export function formatCountdownHint(trip: Trip | null, daysUntil: number | null): string {
  if (!trip) return "Crie a viagem Disney + NBA";
  if (daysUntil === null) return formatTripDateRange(trip);
  if (daysUntil < 0) return `Encerrada · ${formatDate(trip.data_volta)}`;
  return formatTripDateRange(trip);
}

export function buildEnglishSummaryLines(
  progress: LanguageProgress | null,
  sessions: LanguageSession[],
  lessons: LanguageLesson[]
): string[] {
  const base = buildLanguageReportLines(progress, sessions, lessons);
  const disneySessions = sessions.filter((s) => s.modo === "disney" || s.modo === "nba");
  if (disneySessions.length > 0) {
    base.push(
      `Práticas Disney/NBA: ${disneySessions.length}`,
      `Última prática Disney/NBA: ${disneySessions[0]?.data ?? "—"}`
    );
  }
  if (progress?.modo_favorito) {
    base.push(`Modo favorito: ${getEnglishModoLabel(progress.modo_favorito)}`);
  }
  base.push(getStreakEmoji(progress?.streak_dias ?? 0));
  return base;
}
