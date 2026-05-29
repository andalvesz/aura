"use client";

import { BookOpen, Brain, Check, Dumbbell, Utensils } from "lucide-react";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

const habits: { label: string; done: boolean }[] = [];

const weekProgress: number[] = [];

export function SaudeView() {
  const doneCount = habits.filter((h) => h.done).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard label="Hábitos hoje" value="0/0" />
        <MetricCard label="Progresso semanal" value="—" hint="Nenhuma meta definida" />
        <MetricCard label="Treinos/semana" value="—" hint="Nenhum treino cadastrado" />
        <MetricCard label="Leitura" value="—" hint="Nenhuma leitura cadastrada" />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <Panel>
          <PanelHeader className="gap-2">
            <Dumbbell className="size-4 text-rose-400" />
            <PanelTitle>Treino do dia</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <p className="text-[13px] font-medium text-zinc-400">
              Nenhum treino cadastrado
            </p>

            <p className="mt-2 text-[11px] text-zinc-600">
              Crie seu primeiro plano de treino
            </p>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="gap-2">
            <Utensils className="size-4 text-emerald-400" />
            <PanelTitle>Plano alimentar</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <p className="text-[13px] text-zinc-400">
              Nenhum plano alimentar cadastrado
            </p>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="gap-2">
            <Check className="size-4 text-sky-400" />
            <PanelTitle>Checklist de hábitos</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <p className="text-[13px] text-zinc-400">
              Nenhum hábito cadastrado
            </p>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="gap-2">
            <BookOpen className="size-4 text-amber-400" />
            <PanelTitle>Leitura do dia</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <p className="text-[13px] text-zinc-400">
              Nenhuma leitura cadastrada
            </p>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="gap-2">
            <Brain className="size-4 text-violet-400" />
            <PanelTitle>Meditação</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <p className="text-[13px] text-zinc-400">
              Nenhuma sessão configurada
            </p>

            <button
              type="button"
              disabled
              className="mt-3 w-full rounded-md border border-white/[0.08] py-2 text-[12px] text-zinc-500"
            >
              Configurar sessão
            </button>
          </PanelContent>
        </Panel>

        <Panel className="lg:col-span-2 xl:col-span-1">
          <PanelHeader>
            <PanelTitle>Progresso semanal</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <div className="flex h-24 items-center justify-center">
              <p className="text-sm text-zinc-500">
                Nenhum dado registrado ainda
              </p>
            </div>
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}