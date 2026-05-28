"use client";

import { Sparkles } from "lucide-react";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

const networks = [
  { name: "Instagram", planned: 4, published: 12, color: "from-pink-500/40 to-purple-500/40" },
  { name: "YouTube", planned: 2, published: 3, color: "from-red-500/40 to-red-600/30" },
  { name: "TikTok", planned: 5, published: 18, color: "from-zinc-400/30 to-zinc-500/20" },
  { name: "Facebook", planned: 1, published: 6, color: "from-blue-500/40 to-blue-600/30" },
];

const ideas = [
  "5 erros ao montar bar em eventos",
  "Bastidores Alvesz Experience",
  "Como precificar open bar",
  "Tour rápido: kit premium",
];

const contentCalendar = [
  { day: "Seg", items: ["Reels — dica bar"] },
  { day: "Ter", items: [] },
  { day: "Qua", items: ["YouTube — case"] },
  { day: "Qui", items: ["TikTok — trend", "Story — evento"] },
  { day: "Sex", items: ["Post — depoimento"] },
];

export function SocialMediaView() {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ActionButton icon={<Sparkles className="size-3.5" />}>
          Gerar roteiro com IA
        </ActionButton>
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
        <MetricCard label="Vídeos planejados" value="8" hint="3 esta semana" />
        <MetricCard label="Posts publicados" value="39" hint="Mês atual" />
        <MetricCard label="Ideias em análise" value="12" hint="4 prioridade alta" />
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
                  className="min-h-[72px] rounded-md border border-white/[0.04] p-1.5"
                >
                  <p className="text-[10px] font-medium text-zinc-500">{d.day}</p>
                  {d.items.map((item) => (
                    <p
                      key={item}
                      className="mt-1 truncate rounded bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-200/90"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </PanelContent>
        </Panel>
        <Panel>
          <PanelHeader>
            <PanelTitle>Ideias de vídeos</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-1 pt-0">
            {ideas.map((idea) => (
              <div
                key={idea}
                className="rounded-md px-2 py-2 text-[12px] text-zinc-300 transition-colors hover:bg-white/[0.03]"
              >
                {idea}
              </div>
            ))}
          </PanelContent>
        </Panel>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {networks.map((n) => (
          <Panel key={n.name}>
            <PanelContent className="py-3">
              <div
                className={`mb-2 h-1 rounded-full bg-gradient-to-r ${n.color}`}
              />
              <p className="text-[13px] font-medium text-zinc-200">{n.name}</p>
              <div className="mt-2 flex justify-between text-[11px]">
                <span className="text-zinc-600">
                  Planejados: <span className="text-zinc-400">{n.planned}</span>
                </span>
                <span className="text-zinc-600">
                  Publicados: <span className="text-emerald-400/90">{n.published}</span>
                </span>
              </div>
            </PanelContent>
          </Panel>
        ))}
      </div>
    </div>
  );
}
