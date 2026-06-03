"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Brain,
  Check,
  Dumbbell,
  Plus,
  Trash2,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import {
  useHealthHabits,
  useHealthMeals,
  useHealthSessions,
  useHealthWorkouts,
} from "@/hooks";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { AuraSaude } from "./aura-saude";
import { AddHealthHabitModal } from "./add-health-habit-modal";
import { AddHealthWorkoutModal } from "./add-health-workout-modal";
import { AddHealthMealModal } from "./add-health-meal-modal";
import { AddHealthSessionModal } from "./add-health-session-modal";
import { HealthSuggestionPreview } from "./health-suggestion-preview";
import {
  computeHealthMetrics,
  computeWeeklyProgress,
  exerciciosToJson,
  mealsForToday,
  parseExercicios,
  sessionsThisWeek,
  todayIsoDate,
  workoutForToday,
  workoutsThisWeek,
  type ParsedHabitsPlanSuggestion,
  type ParsedMealPlanSuggestion,
  type ParsedWorkoutSuggestion,
} from "@/utils/health";

type ActiveSuggestion =
  | { type: "treino"; data: ParsedWorkoutSuggestion }
  | { type: "dieta"; data: ParsedMealPlanSuggestion }
  | { type: "habitos"; data: ParsedHabitsPlanSuggestion };

export function SaudeView() {
  const { data: habits, loading: loadingHabits, create: createHabit, remove: removeHabit } =
    useHealthHabits();
  const {
    data: workouts,
    loading: loadingWorkouts,
    create: createWorkout,
  } = useHealthWorkouts();
  const { data: meals, loading: loadingMeals, create: createMeal, remove: removeMeal } =
    useHealthMeals();
  const {
    data: sessions,
    loading: loadingSessions,
    create: createSession,
    remove: removeSession,
  } = useHealthSessions();

  const [habitModal, setHabitModal] = useState(false);
  const [workoutModal, setWorkoutModal] = useState(false);
  const [mealModal, setMealModal] = useState(false);
  const [sessionModal, setSessionModal] = useState<"leitura" | "meditacao" | null>(null);
  const [workoutSuggestion, setWorkoutSuggestion] = useState<ParsedWorkoutSuggestion | null>(
    null
  );
  const [mealSuggestion, setMealSuggestion] = useState<
    ParsedMealPlanSuggestion["refeicoes"][0] | null
  >(null);
  const [activeSuggestion, setActiveSuggestion] = useState<ActiveSuggestion | null>(null);

  const loading =
    loadingHabits || loadingWorkouts || loadingMeals || loadingSessions;

  const metrics = useMemo(
    () => computeHealthMetrics(habits, workouts, sessions),
    [habits, workouts, sessions]
  );

  const weeklyProgress = useMemo(
    () => computeWeeklyProgress(habits, workouts, sessions, meals),
    [habits, workouts, sessions, meals]
  );

  const treinoHoje = useMemo(() => workoutForToday(workouts), [workouts]);
  const treinosSemana = useMemo(() => workoutsThisWeek(workouts), [workouts]);
  const refeicoesHoje = useMemo(() => mealsForToday(meals), [meals]);
  const habitsHoje = useMemo(
    () => habits.filter((h) => h.data === todayIsoDate()),
    [habits]
  );
  const sessoesSemana = useMemo(() => sessionsThisWeek(sessions), [sessions]);
  const leituras = useMemo(
    () => sessions.filter((s) => s.tipo === "leitura").slice(0, 5),
    [sessions]
  );
  const meditacoes = useMemo(
    () => sessions.filter((s) => s.tipo === "meditacao").slice(0, 5),
    [sessions]
  );

  async function handleSaveWorkoutSuggestion(workout: ParsedWorkoutSuggestion) {
    if (!confirm(`Salvar treino "${workout.nome}" para hoje?`)) return;

    const { error } = await createWorkout({
      nome: workout.nome,
      grupo_muscular: workout.grupo_muscular,
      exercicios: exerciciosToJson(workout.exercicios),
      duracao_min: workout.duracao_min,
      observacoes: workout.observacoes,
      data: todayIsoDate(),
    });

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Treino salvo.");
    setActiveSuggestion(null);
  }

  async function handleSaveMealPlan(plan: ParsedMealPlanSuggestion) {
    if (!confirm(`Salvar ${plan.refeicoes.length} refeições para hoje?`)) return;

    for (const refeicao of plan.refeicoes) {
      const { error } = await createMeal({
        nome: refeicao.nome,
        horario: refeicao.horario.length === 5 ? `${refeicao.horario}:00` : refeicao.horario,
        alimentos: refeicao.alimentos || null,
        calorias: refeicao.calorias ?? null,
        observacoes: refeicao.observacoes ?? null,
        data: todayIsoDate(),
      });
      if (error) {
        toast.error(error);
        return;
      }
    }

    toast.success("Plano alimentar salvo.");
    setActiveSuggestion(null);
  }

  async function handleSaveHabitsPlan(plan: ParsedHabitsPlanSuggestion) {
    if (!confirm(`Salvar ${plan.habitos.length} hábitos sugeridos?`)) return;

    for (const habit of plan.habitos) {
      const { error } = await createHabit({
        titulo: habit.titulo,
        frequencia: habit.frequencia,
        status: "ativo",
        data: habit.data,
      });
      if (error) {
        toast.error(error);
        return;
      }
    }

    toast.success("Hábitos salvos.");
    setActiveSuggestion(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton icon={<Plus className="size-3.5" />} onClick={() => setHabitModal(true)}>
          Novo hábito
        </ActionButton>
        <ActionButton
          icon={<Dumbbell className="size-3.5" />}
          onClick={() => {
            setWorkoutSuggestion(null);
            setWorkoutModal(true);
          }}
        >
          Novo treino
        </ActionButton>
        <ActionButton
          icon={<Utensils className="size-3.5" />}
          onClick={() => {
            setMealSuggestion(null);
            setMealModal(true);
          }}
        >
          Nova refeição
        </ActionButton>
        <ActionButton
          icon={<BookOpen className="size-3.5" />}
          onClick={() => setSessionModal("leitura")}
        >
          Nova leitura
        </ActionButton>
        <ActionButton
          icon={<Brain className="size-3.5" />}
          onClick={() => setSessionModal("meditacao")}
        >
          Nova meditação
        </ActionButton>
      </div>

      {loading ? (
        <MetricsSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
          <MetricCard
            label="Hábitos hoje"
            value={String(metrics.habitsHoje)}
            hint={`${metrics.habitsAtivos} ativos no total`}
          />
          <MetricCard
            label="Treinos/semana"
            value={String(metrics.treinosSemana)}
            hint="Últimos 7 dias"
          />
          <MetricCard
            label="Refeições hoje"
            value={String(refeicoesHoje.length)}
            hint="Plano alimentar do dia"
          />
          <MetricCard
            label="Leitura · Meditação"
            value={`${metrics.leituras} · ${metrics.meditacoes}`}
            hint={`${sessoesSemana.length} sessões na semana`}
          />
          <MetricCard
            label="Progresso semanal"
            value={`${weeklyProgress.score}%`}
            hint={`${weeklyProgress.workoutsWeek} treinos · ${weeklyProgress.habitsWeek} hábitos`}
            hintClassName={
              weeklyProgress.score >= 60 ? "text-emerald-500/80" : undefined
            }
          />
        </div>
      )}

      {activeSuggestion?.type === "treino" && (
        <HealthSuggestionPreview
          type="treino"
          workout={activeSuggestion.data}
          onSave={() => handleSaveWorkoutSuggestion(activeSuggestion.data)}
          onDismiss={() => setActiveSuggestion(null)}
        />
      )}
      {activeSuggestion?.type === "dieta" && (
        <HealthSuggestionPreview
          type="dieta"
          mealPlan={activeSuggestion.data}
          onSave={() => handleSaveMealPlan(activeSuggestion.data)}
          onDismiss={() => setActiveSuggestion(null)}
        />
      )}
      {activeSuggestion?.type === "habitos" && (
        <HealthSuggestionPreview
          type="habitos"
          habitsPlan={activeSuggestion.data}
          onSave={() => handleSaveHabitsPlan(activeSuggestion.data)}
          onDismiss={() => setActiveSuggestion(null)}
        />
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-2 lg:grid-cols-2">
          <Panel>
            <PanelHeader className="gap-2">
              <Check className="size-4 text-sky-400" />
              <PanelTitle>Hábitos de hoje</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {loadingHabits ? (
                <ListSkeleton rows={4} />
              ) : habitsHoje.length === 0 ? (
                <EmptyState
                  title="Nenhum hábito hoje"
                  description="Cadastre hábitos ou peça à Aura Saúde para organizar a semana."
                />
              ) : (
                <ul className="space-y-1.5">
                  {habitsHoje.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5 text-[12px]"
                    >
                      <span className="text-zinc-300">{h.titulo}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const { error } = await removeHabit(h.id);
                          if (error) toast.error(error);
                        }}
                        className="text-zinc-600 hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader className="gap-2">
              <Dumbbell className="size-4 text-rose-400" />
              <PanelTitle>Treino do dia</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {loadingWorkouts ? (
                <ListSkeleton rows={3} />
              ) : !treinoHoje ? (
                <EmptyState
                  title="Nenhum treino hoje"
                  description="Crie manualmente ou use o atalho Treino de hoje na Aura Saúde."
                />
              ) : (
                <div>
                  <p className="text-[13px] font-medium text-zinc-200">{treinoHoje.nome}</p>
                  <p className="text-[11px] capitalize text-zinc-500">
                    {treinoHoje.grupo_muscular.replace("_", " ")} · {treinoHoje.duracao_min}{" "}
                    min
                  </p>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-400">
                    {parseExercicios(treinoHoje.exercicios)
                      .slice(0, 6)
                      .map((ex, i) => (
                        <li key={i}>· {ex.nome}</li>
                      ))}
                  </ul>
                </div>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader className="gap-2">
              <Utensils className="size-4 text-emerald-400" />
              <PanelTitle>Refeições planejadas</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {loadingMeals ? (
                <ListSkeleton rows={3} />
              ) : refeicoesHoje.length === 0 ? (
                <EmptyState
                  title="Nenhuma refeição hoje"
                  description="Cadastre refeições ou peça uma dieta simples à Aura Saúde."
                />
              ) : (
                <ul className="space-y-2">
                  {refeicoesHoje.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2 text-[12px]">
                      <span className="text-zinc-300">
                        {m.horario.slice(0, 5)} — {m.nome}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Excluir refeição?")) return;
                          const { error } = await removeMeal(m.id);
                          if (error) toast.error(error);
                        }}
                        className="text-zinc-600 hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader className="gap-2">
              <TrendingUp className="size-4 text-violet-400" />
              <PanelTitle>Treinos da semana</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {loadingWorkouts ? (
                <ListSkeleton rows={4} />
              ) : treinosSemana.length === 0 ? (
                <EmptyState title="Nenhum treino na semana" description="Registre seus treinos." />
              ) : (
                <ul className="space-y-1.5 text-[12px]">
                  {treinosSemana.map((w) => (
                    <li key={w.id} className="text-zinc-300">
                      <span className="text-zinc-500">{w.data.slice(5)}</span> — {w.nome}
                      <span className="text-zinc-600"> · {w.duracao_min} min</span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader className="gap-2">
              <BookOpen className="size-4 text-amber-400" />
              <PanelTitle>Leitura</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-2 pt-0">
              {leituras.length === 0 ? (
                <EmptyState title="Nenhuma leitura" description="Registre sessões de leitura." />
              ) : (
                leituras.map((s) => (
                  <SessionRow
                    key={s.id}
                    titulo={s.titulo}
                    duracao={s.duracao_min}
                    onDelete={async () => {
                      const { error } = await removeSession(s.id);
                      if (error) toast.error(error);
                    }}
                  />
                ))
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader className="gap-2">
              <Brain className="size-4 text-violet-400" />
              <PanelTitle>Meditação</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-2 pt-0">
              {meditacoes.length === 0 ? (
                <EmptyState title="Nenhuma meditação" description="Registre sessões de meditação." />
              ) : (
                meditacoes.map((s) => (
                  <SessionRow
                    key={s.id}
                    titulo={s.titulo}
                    duracao={s.duracao_min}
                    onDelete={async () => {
                      const { error } = await removeSession(s.id);
                      if (error) toast.error(error);
                    }}
                  />
                ))
              )}
            </PanelContent>
          </Panel>
        </div>

        <AuraSaude
          onWorkoutSuggestion={(suggestion) =>
            setActiveSuggestion({ type: "treino", data: suggestion })
          }
          onMealPlanSuggestion={(suggestion) =>
            setActiveSuggestion({ type: "dieta", data: suggestion })
          }
          onHabitsSuggestion={(suggestion) =>
            setActiveSuggestion({ type: "habitos", data: suggestion })
          }
        />
      </div>

      <AddHealthHabitModal
        open={habitModal}
        onClose={() => setHabitModal(false)}
        onSubmit={async (payload) => {
          const result = await createHabit(payload);
          return { error: result.error };
        }}
      />
      <AddHealthWorkoutModal
        open={workoutModal}
        onClose={() => {
          setWorkoutModal(false);
          setWorkoutSuggestion(null);
        }}
        initial={workoutSuggestion}
        onSubmit={async (payload) => {
          const result = await createWorkout(payload);
          return { error: result.error };
        }}
      />
      <AddHealthMealModal
        open={mealModal}
        onClose={() => {
          setMealModal(false);
          setMealSuggestion(null);
        }}
        initial={mealSuggestion}
        onSubmit={async (payload) => {
          const result = await createMeal(payload);
          return { error: result.error };
        }}
      />
      {sessionModal && (
        <AddHealthSessionModal
          open={Boolean(sessionModal)}
          onClose={() => setSessionModal(null)}
          defaultTipo={sessionModal}
          onSubmit={async (payload) => {
            const result = await createSession(payload);
            return { error: result.error };
          }}
        />
      )}
    </div>
  );
}

function SessionRow({
  titulo,
  duracao,
  onDelete,
}: {
  titulo: string;
  duracao: number;
  onDelete: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-zinc-300">
        {titulo} · {duracao} min
      </span>
      <button
        type="button"
        onClick={async () => {
          if (!confirm("Excluir sessão?")) return;
          await onDelete();
        }}
        className="text-zinc-600 hover:text-red-400"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
