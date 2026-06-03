"use client";

import {
  Activity,
  Apple,
  HeartPulse,
  ListChecks,
  Loader2,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useRef, useState } from "react";
import { parseJsonResponse } from "@/utils/safe-json";
import type {
  ParsedHabitsPlanSuggestion,
  ParsedMealPlanSuggestion,
  ParsedWorkoutSuggestion,
} from "@/utils/health";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type QuickAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  mode?: "chat" | "treino" | "dieta" | "habitos";
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "criar-treino-hoje",
    label: "Treino de hoje",
    icon: Activity,
    mode: "treino",
    prompt: "Criar treino de hoje",
  },
  {
    id: "criar-dieta-simples",
    label: "Dieta simples",
    icon: Apple,
    mode: "dieta",
    prompt: "Criar dieta simples para hoje",
  },
  {
    id: "organizar-habitos",
    label: "Hábitos da semana",
    icon: ListChecks,
    mode: "habitos",
    prompt: "Organizar hábitos da semana",
  },
  {
    id: "plano-recuperacao",
    label: "Recuperação leve",
    icon: HeartPulse,
    mode: "chat",
    prompt: "Plano de recuperação leve para o ombro",
  },
  {
    id: "rotina-atleta",
    label: "Rotina de atleta",
    icon: Trophy,
    mode: "chat",
    prompt: "Montar rotina de atleta adaptada",
  },
];

type AuraSaudeProps = {
  onWorkoutSuggestion: (suggestion: ParsedWorkoutSuggestion) => void;
  onMealPlanSuggestion: (suggestion: ParsedMealPlanSuggestion) => void;
  onHabitsSuggestion: (suggestion: ParsedHabitsPlanSuggestion) => void;
};

function parseWorkoutSuggestion(raw: Record<string, unknown>): ParsedWorkoutSuggestion | null {
  if (!raw.nome) return null;
  const exercicios = Array.isArray(raw.exercicios)
    ? raw.exercicios.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          nome: String(row.nome ?? "Exercício"),
          series: row.series != null ? String(row.series) : undefined,
          reps: row.reps != null ? String(row.reps) : undefined,
          observacao: row.observacao != null ? String(row.observacao) : undefined,
        };
      })
    : [];

  return {
    nome: String(raw.nome),
    grupo_muscular: String(raw.grupo_muscular ?? "geral"),
    duracao_min: Number(raw.duracao_min) || 45,
    exercicios,
    observacoes: raw.observacoes ? String(raw.observacoes) : null,
  };
}

function parseMealPlanSuggestion(raw: Record<string, unknown>): ParsedMealPlanSuggestion | null {
  if (!Array.isArray(raw.refeicoes) || raw.refeicoes.length === 0) return null;

  const refeicoes = raw.refeicoes.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      nome: String(row.nome ?? "Refeição"),
      horario: String(row.horario ?? "12:00").slice(0, 5),
      alimentos: String(row.alimentos ?? ""),
      calorias: row.calorias != null ? Number(row.calorias) : null,
      observacoes: row.observacoes ? String(row.observacoes) : null,
    };
  });

  return {
    resumo: raw.resumo ? String(raw.resumo) : null,
    refeicoes,
  };
}

function parseHabitsPlanSuggestion(
  raw: Record<string, unknown>
): ParsedHabitsPlanSuggestion | null {
  if (!Array.isArray(raw.habitos) || raw.habitos.length === 0) return null;

  const habitos = raw.habitos.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      titulo: String(row.titulo ?? "Hábito"),
      frequencia: String(row.frequencia ?? "diario"),
      data: String(row.data ?? new Date().toISOString().slice(0, 10)),
    };
  });

  return {
    resumo: raw.resumo ? String(raw.resumo) : null,
    habitos,
  };
}

export function AuraSaude({
  onWorkoutSuggestion,
  onMealPlanSuggestion,
  onHabitsSuggestion,
}: AuraSaudeProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Olá, Anderson. Sou a Aura Saúde — sua assistente para treinos, hábitos, dieta, leitura e meditação. Uso seus dados reais e nunca substituo um profissional de saúde.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function sendMessage(
    text: string,
    options?: { actionId?: string; mode?: QuickAction["mode"] }
  ) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    scrollToBottom();

    try {
      const response = await fetch("/api/health-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          ...(options?.actionId ? { actionId: options.actionId } : {}),
          ...(options?.mode ? { mode: options.mode } : {}),
        }),
      });

      const { data, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
        suggestion?: Record<string, unknown>;
        kind?: string;
      }>(response);

      if (parseError || !response.ok) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: parseError ?? data?.error ?? "Não consegui responder agora.",
          },
        ]);
        return;
      }

      if (data?.error) {
        setMessages((current) => [
          ...current,
          { role: "assistant", text: data.error! },
        ]);
        return;
      }

      if (data?.kind === "treino" && data.suggestion) {
        const workout = parseWorkoutSuggestion(data.suggestion);
        if (workout) {
          onWorkoutSuggestion(workout);
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              text: `Treino "${workout.nome}" gerado. Revise o plano abaixo e confirme para salvar.`,
            },
          ]);
          return;
        }
      }

      if (data?.kind === "dieta" && data.suggestion) {
        const plan = parseMealPlanSuggestion(data.suggestion);
        if (plan) {
          onMealPlanSuggestion(plan);
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              text: `Dieta com ${plan.refeicoes.length} refeições gerada. Revise o plano abaixo e confirme para salvar.`,
            },
          ]);
          return;
        }
      }

      if (data?.kind === "habitos" && data.suggestion) {
        const plan = parseHabitsPlanSuggestion(data.suggestion);
        if (plan) {
          onHabitsSuggestion(plan);
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              text: `${plan.habitos.length} hábitos sugeridos. Revise abaixo e confirme para salvar.`,
            },
          ]);
          return;
        }
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data?.text ?? "Não consegui responder agora.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Erro ao conectar com a Aura Saúde. Tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleQuickAction(action: QuickAction) {
    sendMessage(action.prompt, {
      actionId: action.id,
      mode: action.mode,
    });
  }

  return (
    <Panel className="border-rose-500/10 bg-rose-500/[0.02]">
      <PanelHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-rose-500/15">
            <Sparkles className="size-3.5 text-rose-400" />
          </div>
          <div>
            <PanelTitle>Aura Saúde</PanelTitle>
            <p className="text-[10px] text-zinc-600">
              IA real · Treinos · Hábitos · Dieta · Leitura · Meditação
            </p>
          </div>
        </div>
      </PanelHeader>

      <PanelContent className="pt-0">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={loading}
                onClick={() => handleQuickAction(action)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-rose-400/20 hover:bg-rose-500/[0.06] hover:text-rose-200 disabled:opacity-50"
              >
                <Icon className="size-3 shrink-0" />
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="mb-3 max-h-[320px] space-y-2 overflow-y-auto rounded-lg border border-white/[0.06] bg-zinc-950/40 p-2">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                message.role === "user"
                  ? "ml-6 bg-white/[0.06] text-zinc-200"
                  : "mr-6 bg-rose-500/10 text-rose-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          ))}

          {loading && (
            <div className="mr-6 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[13px] text-rose-300">
              <Loader2 className="size-3.5 animate-spin" />
              Analisando sua rotina...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: treino leve para ombro, dieta do dia, hábitos..."
            disabled={loading}
            className="h-10 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:border-rose-400/40 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-rose-500 text-white transition hover:bg-rose-400 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </form>
      </PanelContent>
    </Panel>
  );
}
