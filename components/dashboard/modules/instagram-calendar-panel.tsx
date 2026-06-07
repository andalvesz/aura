"use client";

import { useState } from "react";
import type { Conteudo } from "@/types/database";
import { conteudosNoMes } from "@/utils/instagram";
import {
  conteudosNaSemana,
  getConteudoStatusLabel,
  normalizeConteudoStatus,
} from "@/utils/social";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";

type InstagramCalendarPanelProps = {
  conteudos: Conteudo[];
  onSelect: (c: Conteudo) => void;
};

export function InstagramCalendarPanel({
  conteudos,
  onSelect,
}: InstagramCalendarPanelProps) {
  const [view, setView] = useState<"semana" | "mes">("semana");
  const semana = conteudosNaSemana(conteudos);
  const mes = conteudosNoMes(conteudos);

  return (
    <Panel>
      <PanelHeader className="flex flex-row items-center justify-between">
        <PanelTitle>Calendário visual</PanelTitle>
        <div className="flex gap-1">
          {(["semana", "mes"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-2 py-1 text-[10px] ${
                view === v
                  ? "bg-violet-500/20 text-violet-200"
                  : "text-zinc-500 hover:bg-white/[0.04]"
              }`}
            >
              {v === "semana" ? "Semanal" : "Mensal"}
            </button>
          ))}
        </div>
      </PanelHeader>
      <PanelContent className="overflow-x-auto pt-0">
        {view === "semana" ? (
          <div className="grid min-w-[420px] grid-cols-7 gap-1">
            {semana.map((d) => (
              <DayCell
                key={d.date}
                label={d.day}
                sub={d.date.slice(8, 10)}
                items={d.items}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div>
            <p className="mb-2 text-[11px] text-zinc-500">{mes.monthLabel}</p>
            <div className="grid min-w-[560px] grid-cols-7 gap-1">
              {["S", "T", "Q", "Q", "S", "S", "D"].map((h) => (
                <p key={h} className="text-center text-[9px] text-zinc-600">
                  {h}
                </p>
              ))}
              {Array.from({ length: mes.startPad }).map((_, i) => (
                <div key={`pad-${i}`} className="min-h-[52px]" />
              ))}
              {mes.days.map((d) => (
                <DayCell
                  key={d.date}
                  label={String(d.day)}
                  items={d.items}
                  onSelect={onSelect}
                  compact
                />
              ))}
            </div>
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}

function DayCell({
  label,
  sub,
  items,
  onSelect,
  compact,
}: {
  label: string;
  sub?: string;
  items: Conteudo[];
  onSelect: (c: Conteudo) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-md border border-white/[0.04] p-1.5 ${
        compact ? "min-h-[52px]" : "min-h-[80px]"
      } ${items.length > 0 ? "bg-violet-500/[0.04]" : ""}`}
    >
      <p className="text-[10px] font-medium text-zinc-500">
        {label}
        {sub && <span className="text-zinc-600">/{sub}</span>}
      </p>
      <div className="mt-0.5 flex-1 space-y-0.5">
        {items.length === 0 ? (
          !compact && <p className="text-[9px] text-zinc-700">—</p>
        ) : (
          items.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="block w-full truncate text-left text-[9px] text-violet-300/90 hover:text-violet-200"
              title={`${c.titulo} (${getConteudoStatusLabel(normalizeConteudoStatus(c.status))})`}
            >
              {c.titulo}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
