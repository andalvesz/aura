"use client";

import { Plus, Sparkles } from "lucide-react";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

const networks = [
  { name: "Instagram", color: "from-pink-500/40 to-purple-500/40" },
  { name: "YouTube", color: "from-red-500/40 to-red-600/30" },
  { name: "TikTok", color: "from-zinc-400/30 to-zinc-500/20" },
  { name: "Facebook", color: "from-blue-500/40 to-blue-600/30" },
];

const contentCalendar = [
  { day: "Seg" },
  { day: "Ter" },
  { day: "Qua" },
  { day: "Qui" },
  { day: "Sex" },
];

export function SocialMediaView() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <ActionButton icon={<Plus className="size-3.5" />}>
          Adicionar ideia
        </ActionButton>

        <ActionButton icon={<Sparkles className="size-3.5" />}>
          Gerar roteiro com IA
        </ActionButton>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        <MetricCard label="Vídeos planejados" value="0" hint="Nenhum vídeo cadastrado" />
        <MetricCard label="Posts publicados" value="0" hint="Nenhum post publicado" />
        <MetricCard label="Ideias em análise" value="0" hint="Nenhuma ideia cadastrada" />
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Calendário de conteúdo</PanelTitle>
          </PanelHeader>

          <PanelContent className="overflow-x-auto pt-0">
            <div className="grid min-w-[280px] grid-cols-5 gap-1">
              {contentCalendar.map((d) => (
                <div
                  key={d.day}
                  className="flex min-h-[72px] flex-col rounded-md border border-white/[0.04] p-1.5"
                >
                  <p className="text-[10px] font-medium text-zinc-500">{d.day}</p>

                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-[9px] text-zinc-600">Vazio</p>
                  </div>
                </div>
              ))}
            </div>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Ideias de vídeos</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-white/[0.06]">
              <div className="text-center">
                <p className="text-[13px] font-medium text-zinc-400">
                  Nenhuma ideia cadastrada
                </p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  Adicione ideias de vídeos, posts e roteiros.
                </p>
              </div>
            </div>
          </PanelContent>
        </Panel>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {networks.map((n) => (
          <Panel key={n.name}>
            <PanelContent className="py-3">
              <div className={`mb-2 h-1 rounded-full bg-gradient-to-r ${n.color}`} />

              <p className="text-[13px] font-medium text-zinc-200">{n.name}</p>

              <div className="mt-2 flex justify-between text-[11px]">
                <span className="text-zinc-600">
                  Planejados: <span className="text-zinc-400">0</span>
                </span>

                <span className="text-zinc-600">
                  Publicados: <span className="text-zinc-400">0</span>
                </span>
              </div>
            </PanelContent>
          </Panel>
        ))}
      </div>
    </div>
  );
}