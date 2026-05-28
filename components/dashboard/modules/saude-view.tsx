"use client";

import { BookOpen, Brain, Check, Dumbbell, Utensils } from "lucide-react";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

const habits = [
  { label: "Água 3L", done: true },
  { label: "8h sono", done: true },
  { label: "Sem açúcar", done: false },
  { label: "Alongamento", done: true },
  { label: "Leitura 20min", done: false },
  { label: "Meditação", done: true },
];

const weekProgress = [60, 80, 45, 90, 70, 85, 67];

export function SaudeView() {
  const doneCount = habits.filter((h) => h.done).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard label="Hábitos hoje" value={`${doneCount}/${habits.length}`} />
        <MetricCard label="Progresso semanal" value="67%" hint="Meta: 80%" />
        <MetricCard label="Treinos/semana" value="4/5" hint="Falta 1 sessão" />
        <MetricCard label="Leitura" value="18 min" hint="Meta: 20 min" />
      </div>
      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <Panel>
          <PanelHeader className="gap-2">
            <Dumbbell className="size-4 text-rose-400" />
            <PanelTitle>Treino do dia</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <p className="text-[13px] font-medium text-zinc-200">Pernas + Core</p>
            <ul className="mt-2 space-y-1 text-[12px] text-zinc-500">
              <li>· Agachamento 4×10</li>
              <li>· Leg press 3×12</li>
              <li>· Stiff 3×10</li>
              <li>· Prancha 3×45s</li>
            </ul>
            <p className="mt-2 text-[11px] text-zinc-600">~55 min · Academia</p>
          </PanelContent>
        </Panel>
        <Panel>
          <PanelHeader className="gap-2">
            <Utensils className="size-4 text-emerald-400" />
            <PanelTitle>Plano alimentar</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2 pt-0 text-[12px]">
            <div className="rounded-md bg-white/[0.02] p-2">
              <p className="text-zinc-500">Café</p>
              <p className="text-zinc-200">Ovos + aveia + fruta</p>
            </div>
            <div className="rounded-md bg-white/[0.02] p-2">
              <p className="text-zinc-500">Almoço</p>
              <p className="text-zinc-200">Frango, arroz integral, salada</p>
            </div>
            <div className="rounded-md bg-white/[0.02] p-2">
              <p className="text-zinc-500">Jantar</p>
              <p className="text-zinc-200">Peixe + legumes + batata doce</p>
            </div>
          </PanelContent>
        </Panel>
        <Panel>
          <PanelHeader className="gap-2">
            <Check className="size-4 text-sky-400" />
            <PanelTitle>Checklist de hábitos</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-1 pt-0">
            {habits.map((h) => (
              <label
                key={h.label}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition-colors hover:bg-white/[0.03]"
              >
                <span
                  className={`flex size-4 items-center justify-center rounded border ${
                    h.done
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                      : "border-white/10"
                  }`}
                >
                  {h.done && <Check className="size-2.5" />}
                </span>
                <span className={h.done ? "text-zinc-500 line-through" : "text-zinc-300"}>
                  {h.label}
                </span>
              </label>
            ))}
          </PanelContent>
        </Panel>
        <Panel>
          <PanelHeader className="gap-2">
            <BookOpen className="size-4 text-amber-400" />
            <PanelTitle>Leitura do dia</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <p className="text-[13px] font-medium text-zinc-200">
              Atomic Habits — James Clear
            </p>
            <p className="mt-1 text-[12px] text-zinc-500">
              Cap. 8 — Como criar uma identidade que sustenta bons hábitos.
            </p>
          </PanelContent>
        </Panel>
        <Panel>
          <PanelHeader className="gap-2">
            <Brain className="size-4 text-violet-400" />
            <PanelTitle>Meditação</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <p className="text-[13px] text-zinc-200">Respiração 4-7-8 · 10 min</p>
            <p className="mt-1 text-[11px] text-zinc-600">Sugerido: 07:30 ou antes de dormir</p>
            <button
              type="button"
              className="mt-3 w-full rounded-md border border-white/[0.08] py-2 text-[12px] text-zinc-300 transition-colors hover:bg-white/[0.04]"
            >
              Iniciar sessão
            </button>
          </PanelContent>
        </Panel>
        <Panel className="lg:col-span-2 xl:col-span-1">
          <PanelHeader>
            <PanelTitle>Progresso semanal</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <div className="flex h-24 items-end justify-between gap-1">
              {weekProgress.map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-rose-500/60 to-rose-400/30"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[9px] text-zinc-600">
                    {["D", "S", "T", "Q", "Q", "S", "S"][i]}
                  </span>
                </div>
              ))}
            </div>
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
