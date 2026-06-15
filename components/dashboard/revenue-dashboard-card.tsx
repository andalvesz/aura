"use client";

import Link from "next/link";
import { CircleDollarSign, Loader2 } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useRevenue } from "@/hooks/use-revenue";
import { formatBRL } from "@/utils/format";

export function RevenueDashboardCard() {
  const { dashboard, loading } = useRevenue();

  return (
    <Panel className="border-emerald-500/10 bg-emerald-500/[0.03]">
      <PanelHeader className="flex flex-row items-center justify-between">
        <PanelTitle className="flex items-center gap-2">
          <CircleDollarSign className="size-3.5 text-emerald-400" />
          Aura Revenue Center
        </PanelTitle>
        <Link
          href="/dashboard/revenue"
          className="text-[11px] text-emerald-300/80 hover:text-emerald-200"
        >
          Ver detalhes →
        </Link>
      </PanelHeader>
      <PanelContent className="pt-0">
        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" />
            Carregando...
          </div>
        ) : !dashboard ? (
          <p className="text-[12px] text-zinc-500">
            Conecte fontes de receita.{" "}
            <Link href="/dashboard/revenue" className="text-emerald-300/90 hover:text-emerald-200">
              Abrir Revenue Center
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <MetricCard
              label="Receita"
              value={formatBRL(dashboard.resumo.month)}
              hint="Mês atual"
            />
            <MetricCard
              label="Lucro"
              value={formatBRL(dashboard.lucro.lucroLiquido.month)}
              hint="Líquido mês"
            />
            <MetricCard
              label="Investimento"
              value={formatBRL(dashboard.lucro.investimentoSugerido)}
              hint="Sugerido"
            />
            <MetricCard
              label="ROI"
              value={`${dashboard.lucro.roiPct}%`}
              hint="Lucro / despesas"
            />
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
