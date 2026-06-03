"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type {
  ParsedHabitsPlanSuggestion,
  ParsedMealPlanSuggestion,
  ParsedWorkoutSuggestion,
} from "@/utils/health";

type HealthSuggestionPreviewProps =
  | {
      type: "treino";
      workout: ParsedWorkoutSuggestion;
      onSave: () => Promise<void>;
      onDismiss: () => void;
    }
  | {
      type: "dieta";
      mealPlan: ParsedMealPlanSuggestion;
      onSave: () => Promise<void>;
      onDismiss: () => void;
    }
  | {
      type: "habitos";
      habitsPlan: ParsedHabitsPlanSuggestion;
      onSave: () => Promise<void>;
      onDismiss: () => void;
    };

export function HealthSuggestionPreview(props: HealthSuggestionPreviewProps) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await props.onSave();
    } finally {
      setSaving(false);
    }
  }

  const title =
    props.type === "treino"
      ? "Plano de treino sugerido"
      : props.type === "dieta"
        ? "Plano alimentar sugerido"
        : "Hábitos sugeridos";

  return (
    <Panel className="border-amber-500/20 bg-amber-500/[0.03]">
      <PanelHeader className="items-center">
        <PanelTitle className="text-amber-200">{title}</PanelTitle>
        <button
          type="button"
          onClick={props.onDismiss}
          className="text-zinc-600 transition-colors hover:text-zinc-400"
          aria-label="Fechar plano"
        >
          <X className="size-4" />
        </button>
      </PanelHeader>
      <PanelContent className="space-y-3 pt-0">
        {props.type === "treino" && (
          <>
            <div>
              <p className="text-[14px] font-medium text-zinc-100">{props.workout.nome}</p>
              <p className="text-[11px] capitalize text-zinc-500">
                {props.workout.grupo_muscular.replace("_", " ")} · {props.workout.duracao_min}{" "}
                min
              </p>
              {props.workout.observacoes && (
                <p className="mt-1 text-[11px] text-amber-400/90">{props.workout.observacoes}</p>
              )}
            </div>
            <ul className="space-y-1 text-[12px] text-zinc-300">
              {props.workout.exercicios.map((ex, i) => (
                <li key={i}>
                  · {ex.nome}
                  {[ex.series && `${ex.series}x`, ex.reps].filter(Boolean).length > 0 && (
                    <span className="text-zinc-500">
                      {" "}
                      ({[ex.series && `${ex.series}x`, ex.reps].filter(Boolean).join(" ")})
                    </span>
                  )}
                  {ex.observacao && (
                    <span className="text-zinc-600"> — {ex.observacao}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {props.type === "dieta" && (
          <>
            {props.mealPlan.resumo && (
              <p className="text-[12px] text-zinc-400">{props.mealPlan.resumo}</p>
            )}
            <ul className="space-y-2">
              {props.mealPlan.refeicoes.map((meal, i) => (
                <li
                  key={i}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                >
                  <p className="text-[12px] font-medium text-zinc-200">
                    {meal.horario} — {meal.nome}
                  </p>
                  <p className="text-[11px] text-zinc-500">{meal.alimentos}</p>
                  {meal.calorias != null && (
                    <p className="text-[10px] text-zinc-600">{meal.calorias} kcal</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {props.type === "habitos" && (
          <>
            {props.habitsPlan.resumo && (
              <p className="text-[12px] text-zinc-400">{props.habitsPlan.resumo}</p>
            )}
            <ul className="space-y-1.5">
              {props.habitsPlan.habitos.map((habit, i) => (
                <li
                  key={i}
                  className="flex justify-between gap-2 rounded-md border border-white/[0.06] px-2.5 py-1.5 text-[12px]"
                >
                  <span className="text-zinc-200">{habit.titulo}</span>
                  <span className="shrink-0 text-zinc-600">
                    {habit.frequencia} · {habit.data}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-amber-500/20 text-[12px] font-medium text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Confirmar e salvar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={props.onDismiss}
            className="h-9 rounded-md border border-white/[0.08] px-3 text-[12px] text-zinc-400 hover:bg-white/[0.04]"
          >
            Descartar
          </button>
        </div>
        <p className="text-[10px] text-zinc-600">
          Nada é salvo automaticamente. Revise antes de confirmar.
        </p>
      </PanelContent>
    </Panel>
  );
}
