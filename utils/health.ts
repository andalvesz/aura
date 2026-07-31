import type {
  HealthHabit,
  HealthMeal,
  HealthSession,
  HealthWorkout,
} from "@/types/database";
import type { Json } from "@/types/database";

export const HEALTH_HABIT_FREQUENCIAS = [
  { id: "diario", label: "Diário" },
  { id: "semanal", label: "Semanal" },
  { id: "dias_uteis", label: "Dias úteis" },
] as const;

export const HEALTH_HABIT_STATUSES = [
  { id: "ativo", label: "Ativo" },
  { id: "pausado", label: "Pausado" },
  { id: "concluido", label: "Concluído" },
] as const;

export const HEALTH_GRUPOS_MUSCULARES = [
  "pernas",
  "gluteos",
  "peito",
  "costas",
  "ombros",
  "bracos",
  "core",
  "danca",
  "ginastica",
  "full_body",
  "geral",
] as const;

export const HEALTH_SESSION_TIPOS = [
  { id: "leitura", label: "Leitura" },
  { id: "meditacao", label: "Meditação" },
] as const;

/**
 * Generic health coach system rules — NEVER hardcode another person's injuries,
 * sports history, or medical status. Personal facts come only from the
 * authenticated user's Supabase rows (see buildHealthCoachDataContext).
 */
export const HEALTH_COACH_CONTEXT = `Você é a Aura Saúde — assistente de bem-estar do usuário autenticado.

ISOLAMENTO (obrigatório):
- Use SOMENTE dados pessoais do usuário autenticado fornecidos em ## DADOS REAIS
- Nunca assuma lesões, restrições, esportes, objetivos ou histórico de outra pessoa
- Se ## DADOS REAIS estiver vazio ou sem restrições, PERGUNTE antes de montar treino/dieta:
  objetivos, experiência, restrições/lesões, equipamentos e frequência
- Nunca invente lesões (ex.: ombro) nem copie perfil de outro membro do workspace

REGRAS DE SEGURANÇA (obrigatório):
- Não substitua médico, fisioterapeuta ou nutricionista
- Não prescreva diagnósticos médicos nem medicamentos
- Só aplique cuidados de lesão/restrição se o próprio usuário confirmar ou se constar nos dados reais dele
- Se houver dor aguda ou piora, recomende parar e procurar fisioterapeuta ou médico
- Treinos, dietas e hábitos são sugestões educativas, não tratamento clínico
- Use os dados reais do Supabase quando disponíveis — nunca invente registros`;

export type WorkoutExercise = {
  nome: string;
  series?: string;
  reps?: string;
  observacao?: string;
};

export type ParsedWorkoutSuggestion = {
  nome: string;
  grupo_muscular: string;
  duracao_min: number;
  exercicios: WorkoutExercise[];
  observacoes: string | null;
};

export type ParsedMealPlanSuggestion = {
  refeicoes: {
    nome: string;
    horario: string;
    alimentos: string;
    calorias?: number | null;
    observacoes?: string | null;
  }[];
  resumo: string | null;
};

export function parseExercicios(json: Json): WorkoutExercise[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((item) => typeof item === "object" && item !== null && !Array.isArray(item))
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        nome: String(row.nome ?? row.name ?? "Exercício"),
        series: row.series != null ? String(row.series) : undefined,
        reps: row.reps != null ? String(row.reps) : undefined,
        observacao: row.observacao != null ? String(row.observacao) : undefined,
      };
    });
}

export function exerciciosToJson(exercicios: WorkoutExercise[]): Json {
  return exercicios as unknown as Json;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function computeHealthMetrics(
  habits: HealthHabit[],
  workouts: HealthWorkout[],
  sessions: HealthSession[]
) {
  const hoje = todayIsoDate();
  const habitsHoje = habits.filter((h) => h.data === hoje);
  const habitsAtivos = habits.filter((h) => h.status === "ativo").length;
  const treinosSemana = workouts.filter((w) => {
    const d = new Date(w.data);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < 7;
  }).length;
  const leituras = sessions.filter((s) => s.tipo === "leitura");
  const meditacoes = sessions.filter((s) => s.tipo === "meditacao");

  return {
    habitsHoje: habitsHoje.length,
    habitsAtivos,
    treinosSemana,
    leituras: leituras.length,
    meditacoes: meditacoes.length,
  };
}

export function mealsForToday(meals: HealthMeal[]) {
  const hoje = todayIsoDate();
  return meals
    .filter((m) => m.data === hoje)
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

export function workoutForToday(workouts: HealthWorkout[]) {
  const hoje = todayIsoDate();
  return workouts.find((w) => w.data === hoje) ?? workouts[0] ?? null;
}

export function workoutsThisWeek(workouts: HealthWorkout[]) {
  const now = new Date();
  return workouts
    .filter((w) => {
      const d = new Date(w.data + "T12:00:00");
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff < 7;
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function sessionsThisWeek(sessions: HealthSession[]) {
  const now = new Date();
  return sessions.filter((s) => {
    const d = new Date(s.data + "T12:00:00");
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < 7;
  });
}

export function computeWeeklyProgress(
  habits: HealthHabit[],
  workouts: HealthWorkout[],
  sessions: HealthSession[],
  meals: HealthMeal[]
) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const inWeek = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d >= weekStart && d <= now;
  };

  const habitsWeek = habits.filter((h) => inWeek(h.data)).length;
  const workoutsWeek = workouts.filter((w) => inWeek(w.data)).length;
  const sessionsWeek = sessions.filter((s) => inWeek(s.data)).length;
  const mealsWeek = meals.filter((m) => inWeek(m.data)).length;

  const habitsScore = Math.min(25, Math.round((habitsWeek / 7) * 25));
  const workoutsScore = Math.min(25, Math.round((workoutsWeek / 4) * 25));
  const sessionsScore = Math.min(25, Math.round((sessionsWeek / 5) * 25));
  const mealsScore = Math.min(25, Math.round((mealsWeek / 14) * 25));
  const score = habitsScore + workoutsScore + sessionsScore + mealsScore;

  return {
    habitsWeek,
    workoutsWeek,
    sessionsWeek,
    mealsWeek,
    score,
  };
}

export type ParsedHabitSuggestion = {
  titulo: string;
  frequencia: string;
  data: string;
};

export type ParsedHabitsPlanSuggestion = {
  resumo: string | null;
  habitos: ParsedHabitSuggestion[];
};

export const HEALTH_COACH_ACTIONS = [
  "criar-treino-hoje",
  "criar-dieta-simples",
  "organizar-habitos",
  "plano-recuperacao",
  "rotina-atleta",
] as const;

export type HealthCoachAction = (typeof HEALTH_COACH_ACTIONS)[number];

export function isHealthCoachAction(actionId: string): actionId is HealthCoachAction {
  return HEALTH_COACH_ACTIONS.includes(actionId as HealthCoachAction);
}

export function buildHealthCoachDataContext(
  habits: HealthHabit[],
  workouts: HealthWorkout[],
  meals: HealthMeal[],
  sessions: HealthSession[]
): string {
  const hoje = todayIsoDate();
  const habitsHoje = habits.filter((h) => h.data === hoje);
  const refeicoesHoje = mealsForToday(meals);
  const treinoHoje = workouts.find((w) => w.data === hoje);
  const semanaTreinos = workoutsThisWeek(workouts);
  const semanaSessions = sessionsThisWeek(sessions);
  const progress = computeWeeklyProgress(habits, workouts, sessions, meals);

  const habitLines =
    habitsHoje.length > 0
      ? habitsHoje.map((h) => `* ${h.titulo} (${h.frequencia}, ${h.status})`).join("\n")
      : "* Nenhum hábito registrado hoje";

  const workoutLines =
    semanaTreinos.length > 0
      ? semanaTreinos
          .slice(0, 5)
          .map((w) => `* ${w.data} — ${w.nome} (${w.grupo_muscular}, ${w.duracao_min} min)`)
          .join("\n")
      : "* Nenhum treino na semana";

  const mealLines =
    refeicoesHoje.length > 0
      ? refeicoesHoje
          .map((m) => `* ${m.horario.slice(0, 5)} — ${m.nome}: ${m.alimentos ?? ""}`)
          .join("\n")
      : "* Nenhuma refeição planejada hoje";

  const sessionLines =
    semanaSessions.length > 0
      ? semanaSessions
          .slice(0, 6)
          .map((s) => `* ${s.data} — ${s.tipo}: ${s.titulo} (${s.duracao_min} min, ${s.status})`)
          .join("\n")
      : "* Nenhuma sessão de leitura/mediatação na semana";

  const isEmptyProfile =
    habits.length === 0 &&
    workouts.length === 0 &&
    meals.length === 0 &&
    sessions.length === 0;

  const emptyGuidance = isEmptyProfile
    ? `

### Perfil de saúde
* Nenhum dado pessoal cadastrado para este usuário.
* Antes de montar treino ou dieta, pergunte: objetivo, experiência, restrições/lesões, equipamentos e frequência.
* NÃO assuma lesões, esportes ou histórico de terceiros.`
    : "";

  return `## DADOS REAIS DO SUPABASE (${hoje})
Escopo: PERSONAL — somente o usuário autenticado. Não misturar workspace/owner.
${emptyGuidance}

### Hábitos de hoje
${habitLines}

### Treino de hoje
${treinoHoje ? `* ${treinoHoje.nome} — ${treinoHoje.grupo_muscular} · ${treinoHoje.duracao_min} min` : "* Nenhum treino hoje"}

### Treinos da semana
${workoutLines}

### Refeições de hoje
${mealLines}

### Leitura e meditação (semana)
${sessionLines}

### Progresso semanal
* Score: ${progress.score}/100
* Hábitos: ${progress.habitsWeek} · Treinos: ${progress.workoutsWeek} · Sessões: ${progress.sessionsWeek} · Refeições: ${progress.mealsWeek}

Use estes dados reais nas respostas. Se estiver vazio, informe e pergunte metas/restrições — nunca invente lesões.`;
}

/** Detect leaked hardcodes of another person's injury in health prompts (audit/tests). */
export function healthPromptContainsForeignInjuryAssumption(text: string): boolean {
  const n = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // Patterns split to avoid self-matching this detector source in static audits
  const p1 = ["lesao", "no", "ombro"].join(" ");
  const p2 = ["ombro", "direito", "lesionado"].join(" ");
  const p3 = ["recuperacao", "do", "ombro"].join(" ");
  return (
    n.includes(p1) ||
    n.includes(p2) ||
    n.includes(p3) ||
    (n.includes("anderson") && n.includes("ombro"))
  );
}
