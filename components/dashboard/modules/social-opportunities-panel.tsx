"use client";

import {
  Calendar,
  Landmark,
  Lightbulb,
  Plane,
  Sparkles,
  Target,
  Wine,
} from "lucide-react";
import type { SocialOpportunity, SocialOpportunitySource } from "@/utils/social-intelligence";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { ActionButton } from "../action-button";

const SOURCE_ICONS: Record<SocialOpportunitySource, React.ComponentType<{ className?: string }>> = {
  alvesz_evento: Wine,
  alvesz_orcamento: Wine,
  alvesz_concluido: Wine,
  consorcios_lead: Landmark,
  viagem: Plane,
  disney_nba: Plane,
  english: Sparkles,
  evento: Calendar,
  meta: Target,
  calendario: Calendar,
};

const PRIORITY_STYLES = {
  alta: "border-rose-500/20 bg-rose-500/[0.04] text-rose-200/90",
  media: "border-amber-500/15 bg-amber-500/[0.03] text-amber-100/90",
  baixa: "border-white/[0.06] bg-zinc-950/30 text-zinc-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  reel: "Reel",
  story: "Story",
  bastidores: "Bastidores",
  depoimento: "Depoimento",
  autoridade: "Autoridade",
  objecao: "Objeção",
  prova_social: "Prova social",
  jornada: "Jornada",
  preparacao: "Preparação",
  ingles: "Inglês",
  geral: "Geral",
};

type SocialOpportunitiesPanelProps = {
  opportunities: SocialOpportunity[];
  onAddOpportunity?: (opp: SocialOpportunity) => void;
  onAddAll?: () => void;
};

export function SocialOpportunitiesPanel({
  opportunities,
  onAddOpportunity,
  onAddAll,
}: SocialOpportunitiesPanelProps) {
  if (opportunities.length === 0) {
    return (
      <Panel className="border-emerald-500/10 bg-emerald-500/[0.02]">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Lightbulb className="size-3.5 text-emerald-400" />
            Conteúdos sugeridos automaticamente
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="pt-0">
          <p className="text-[12px] text-zinc-500">
            Nenhuma oportunidade detectada. Cadastre eventos Alvesz, leads de consórcios,
            viagens Disney/NBA ou metas para gerar sugestões.
          </p>
        </PanelContent>
      </Panel>
    );
  }

  return (
    <Panel className="border-emerald-500/10 bg-emerald-500/[0.02]">
      <PanelHeader className="flex flex-row items-center justify-between gap-2">
        <PanelTitle className="flex items-center gap-2">
          <Lightbulb className="size-3.5 text-emerald-400" />
          Conteúdos sugeridos automaticamente
          <span className="text-[11px] font-normal text-zinc-500">
            ({opportunities.length})
          </span>
        </PanelTitle>
        {onAddAll && opportunities.length > 1 && (
          <ActionButton onClick={onAddAll}>Salvar todos</ActionButton>
        )}
      </PanelHeader>
      <PanelContent className="pt-0">
        <p className="mb-2 text-[11px] text-zinc-500">
          Baseado em eventos, metas, viagens, leads e calendário.
        </p>
        <ul className="max-h-[280px] space-y-1.5 overflow-y-auto">
          {opportunities.map((opp) => {
            const Icon = SOURCE_ICONS[opp.source];
            return (
              <li
                key={opp.id}
                className={`rounded-md border px-2.5 py-2 ${PRIORITY_STYLES[opp.prioridade]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Icon className="size-3 shrink-0 opacity-70" />
                      <span className="text-[11px] font-medium">{opp.titulo}</span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">
                        {CATEGORY_LABELS[opp.categoria] ?? opp.categoria}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-relaxed opacity-80">
                      {opp.descricao}
                    </p>
                    <p className="mt-0.5 text-[9px] opacity-60">{opp.sourceLabel}</p>
                  </div>
                  {onAddOpportunity && (
                    <button
                      type="button"
                      onClick={() => onAddOpportunity(opp)}
                      className="shrink-0 rounded px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/10"
                    >
                      + Ideia
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </PanelContent>
    </Panel>
  );
}
