"use client";

import { BarChart3 } from "lucide-react";
import type { SocialReport } from "@/utils/social-intelligence";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

type SocialReportPanelProps = {
  reportSemana: SocialReport;
  reportMes: SocialReport;
};

export function SocialReportPanel({ reportSemana, reportMes }: SocialReportPanelProps) {
  return (
    <Panel className="border-sky-500/10 bg-sky-500/[0.02]">
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <BarChart3 className="size-3.5 text-sky-400" />
          Relatório social
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3 pt-0">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-zinc-400">Esta semana</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MetricCard
              label="Planejado"
              value={String(reportSemana.planejado)}
              hint="Com data nesta semana"
            />
            <MetricCard
              label="Publicado"
              value={String(reportSemana.publicado)}
              hint="Publicados na semana"
            />
            <MetricCard
              label="Atrasado"
              value={String(reportSemana.atrasado)}
              hint="Passou da data planejada"
            />
            <MetricCard
              label="Taxa de execução"
              value={`${reportSemana.taxaExecucao}%`}
              hint="Publicados / planejados"
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-medium text-zinc-400">Este mês</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MetricCard label="Planejado" value={String(reportMes.planejado)} />
            <MetricCard label="Publicado" value={String(reportMes.publicado)} />
            <MetricCard label="Atrasado" value={String(reportMes.atrasado)} />
            <MetricCard
              label="Taxa de execução"
              value={`${reportMes.taxaExecucao}%`}
            />
          </div>
        </div>

        {reportSemana.emProducao > 0 && (
          <p className="text-[11px] text-zinc-500">
            {reportSemana.emProducao} conteúdo(s) em produção (roteiro → editado).
          </p>
        )}
      </PanelContent>
    </Panel>
  );
}
