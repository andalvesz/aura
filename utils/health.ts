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

export const HEALTH_COACH_CONTEXT = `Contexto do usuário — Anderson Alves:
- Pratica dança e ginástica
- Em recuperação de lesão no ombro direito
- Objetivos: evoluir físico, energia e rotina consistente
- Não é profissional de saúde avaliando o usuário

REGRAS DE SEGURANÇA (obrigatório):
- Não prescreva diagnósticos médicos nem medicamentos
- Para lesão no ombro: priorize progressão leve, mobilidade segura, evitar cargas dolorosas
- Se houver dor aguda, recomende procurar fisioterapeita ou médico
- Treinos e dietas são sugestões educativas, não tratamento clínico`;

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
