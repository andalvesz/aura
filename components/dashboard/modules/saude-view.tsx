"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Bot,
  Brain,
  Check,
  Dumbbell,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
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
import {
  computeHealthMetrics,
  mealsForToday,
  parseExercicios,
  todayIsoDate,
  workoutForToday,
  type ParsedMealPlanSuggestion,
  type ParsedWorkoutSuggestion,
  type WorkoutExercise,
} from "@/utils/health";
import { parseJsonResponse } from "@/utils/safe-json";
import { AddHealthHabitModal } from "./add-health-habit-modal";
import { AddHealthWorkoutModal } from "./add-health-workout-modal";
import { AddHealthMealModal } from "./add-health-meal-modal";
import { AddHealthSessionModal } from "./add-health-session-modal";

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
  const [mealSuggestion, setMealSuggestion] = useState<ParsedMealPlanSuggestion["refeicoes"][0] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<"treino" | "dieta" | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: "Olá, Anderson. Sou a Aura Saúde. Posso sugerir treinos leves (ombro em recuperação), refeições e hábitos — sempre com cuidado e sem substituir um profissional.",
    },
  ]);

  const loading =
    loadingHabits || loadingWorkouts || loadingMeals || loadingSessions;

  const metrics = useMemo(
    () => computeHealthMetrics(habits, workouts, sessions),
    [habits, workouts, sessions]
  );

  const treinoHoje = useMemo(() => workoutForToday(workouts), [workouts]);
  const refeicoesHoje = useMemo(() => mealsForToday(meals), [meals]);
  const habitsHoje = useMemo(
    () => habits.filter((h) => h.data === todayIsoDate()),
    [habits]
  );
  const leituras = useMemo(
    () => sessions.filter((s) => s.tipo === "leitura").slice(0, 5),
    [sessions]
  );
  const meditacoes = useMemo(
    () => sessions.filter((s) => s.tipo === "meditacao").slice(0, 5),
    [sessions]
  );

  async function callHealthCoach(message: string, mode: "chat" | "treino" | "dieta") {
    const res = await fetch("/api/health-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, mode }),
    });
    return parseJsonResponse<{
      text?: string;
      error?: string;
      suggestion?: Record<string, unknown>;
      kind?: string;
    }>(res);
  }

  async function handleAiSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setAiLoading(true);

    try {
      const { data, error } = await callHealthCoach(text, "chat");
      if (error || !data) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: data?.error ?? error ?? "Erro de conexão. Cadastre manualmente.",
          },
        ]);
        return;
      }
      if (data.error) {
        setMessages((m) => [...m, { role: "assistant", text: data.error! }]);
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.text ?? "Sem resposta." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Erro de conexão. Use os botões de cadastro manual.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleGerarTreino() {
    setGenLoading("treino");
    try {
      const { data, error } = await callHealthCoach(
        "Crie um treino seguro para hoje, considerando lesão no ombro. Inclua dança/ginástica leve se fizer sentido.",
        "treino"
      );
      if (error || data?.error) {
        toast.error(data?.error ?? error ?? "Erro ao gerar treino.");
        return;
      }
      const s = data?.suggestion;
      if (!s?.nome) {
        toast.error("Sugestão inválida. Cadastre manualmente.");
        return;
      }
      const exercicios = Array.isArray(s.exercicios)
        ? (s.exercicios as WorkoutExercise[])
        : [];
      setWorkoutSuggestion({
        nome: String(s.nome),
        grupo_muscular: String(s.grupo_muscular ?? "geral"),
        duracao_min: Number(s.duracao_min) || 45,
        exercicios,
        observacoes: s.observacoes ? String(s.observacoes) : null,
      });
      setWorkoutModal(true);
      toast.success("Treino sugerido — revise e salve.");
    } catch {
      toast.error("Erro de conexão ao gerar treino.");
    } finally {
      setGenLoading(null);
    }
  }

  async function handleGerarDieta() {
    setGenLoading("dieta");
    try {
      const { data, error } = await callHealthCoach(
        "Monte uma dieta simples e prática para ganho de massa muscular, refeições do dia.",
        "dieta"
      );
      if (error || data?.error) {
        toast.error(data?.error ?? error ?? "Erro ao gerar dieta.");
        return;
      }
      const refeicoes = data?.suggestion?.refeicoes;
      if (!Array.isArray(refeicoes) || refeicoes.length === 0) {
        toast.error("Sugestão inválida. Cadastre manualmente.");
        return;
      }
      const first = refeicoes[0] as Record<string, unknown>;
      setMealSuggestion({
        nome: String(first.nome ?? "Refeição"),
        horario: String(first.horario ?? "12:00").slice(0, 5),
        alimentos: String(first.alimentos ?? ""),
        calorias: first.calorias != null ? Number(first.calorias) : null,
        observacoes: first.observacoes ? String(first.observacoes) : null,
      });
      setMealModal(true);
      toast.success("Primeira refeição sugerida — salve e cadastre as demais se quiser.");
    } catch {
      toast.error("Erro de conexão ao gerar dieta.");
    } finally {
      setGenLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton icon={<Plus className="size-3.5" />} onClick={() => setHabitModal(true)}>
          Novo hábito
        </ActionButton>
        <ActionButton onClick={() => { setWorkoutSuggestion(null); setWorkoutModal(true); }}>
          Novo treino
        </ActionButton>
        <ActionButton onClick={() => { setMealSuggestion(null); setMealModal(true); }}>
          Nova refeição
        </ActionButton>
        <ActionButton
          icon={
            genLoading === "treino" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )
          }
          onClick={handleGerarTreino}
          disabled={genLoading !== null}
        >
          Gerar treino com IA
        </ActionButton>
        <ActionButton
          icon={
            genLoading === "dieta" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )
          }
          onClick={handleGerarDieta}
          disabled={genLoading !== null}
        >
          Gerar dieta com IA
        </ActionButton>
      </div>

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <MetricCard
            label="Hábitos hoje"
            value={`${metrics.habitsHoje}/${habits.length || 0}`}
            hint={`${metrics.habitsAtivos} ativos`}
          />
          <MetricCard
            label="Treinos/semana"
            value={String(metrics.treinosSemana)}
            hint="Últimos 7 dias"
          />
          <MetricCard label="Leituras" value={String(metrics.leituras)} />
          <MetricCard label="Meditações" value={String(metrics.meditacoes)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1fr_minmax(0,280px)]">
        <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
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
                  title="Nenhum treino cadastrado"
                  description="Crie ou gere um treino com IA."
                />
              ) : (
                <div>
                  <p className="text-[13px] font-medium text-zinc-200">{treinoHoje.nome}</p>
                  <p className="text-[11px] capitalize text-zinc-500">
                    {treinoHoje.grupo_muscular} · {treinoHoje.duracao_min} min
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
              <PanelTitle>Plano alimentar</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {loadingMeals ? (
                <ListSkeleton rows={3} />
              ) : refeicoesHoje.length === 0 ? (
                <EmptyState title="Nenhuma refeição hoje" description="Cadastre refeições do dia." />
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
              <Check className="size-4 text-sky-400" />
              <PanelTitle>Hábitos</PanelTitle>
            </PanelHeader>
            <PanelContent className="pt-0">
              {loadingHabits ? (
                <ListSkeleton rows={4} />
              ) : habitsHoje.length === 0 ? (
                <EmptyState title="Nenhum hábito hoje" description="Cadastre hábitos da rotina." />
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
              <BookOpen className="size-4 text-amber-400" />
              <PanelTitle>Leitura</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-2 pt-0">
              {leituras.length === 0 ? (
                <p className="text-[13px] text-zinc-400">Nenhuma leitura cadastrada</p>
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
              <button
                type="button"
                onClick={() => setSessionModal("leitura")}
                className="text-[11px] text-violet-400 hover:text-violet-300"
              >
                + Nova leitura
              </button>
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader className="gap-2">
              <Brain className="size-4 text-violet-400" />
              <PanelTitle>Meditação</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-2 pt-0">
              {meditacoes.length === 0 ? (
                <p className="text-[13px] text-zinc-400">Nenhuma sessão configurada</p>
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
              <button
                type="button"
                onClick={() => setSessionModal("meditacao")}
                className="w-full rounded-md border border-white/[0.08] py-2 text-[12px] text-zinc-300 hover:bg-white/[0.04]"
              >
                Nova meditação
              </button>
            </PanelContent>
          </Panel>
        </div>

        <Panel className="flex min-h-[320px] flex-col">
          <PanelHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-rose-500/15">
                <Sparkles className="size-3.5 text-rose-400" />
              </div>
              <PanelTitle>Aura Saúde</PanelTitle>
            </div>
            <Bot className="size-4 text-zinc-600" />
          </PanelHeader>
          <PanelContent className="flex flex-1 flex-col pt-0">
            <div className="mb-2 max-h-[280px] flex-1 space-y-2 overflow-y-auto">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-md px-2.5 py-2 text-[12px] ${
                    msg.role === "user"
                      ? "ml-4 bg-white/[0.06] text-zinc-200"
                      : "mr-4 bg-rose-500/10 text-rose-100/90"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {aiLoading && (
                <div className="mr-4 flex items-center gap-2 rounded-md bg-rose-500/10 px-2.5 py-2 text-[12px] text-rose-200/80">
                  <Loader2 className="size-3 animate-spin" />
                  Pensando...
                </div>
              )}
            </div>
            <form onSubmit={handleAiSend} className="mt-auto flex gap-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: plano para voltar aos treinos com ombro lesionado..."
                disabled={aiLoading}
                className="h-9 flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="flex size-9 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Send className="size-3.5" />
              </button>
            </form>
          </PanelContent>
        </Panel>
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
