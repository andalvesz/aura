"use client";

import { AlertTriangle, BarChart3, Brain, RefreshCw, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useExpertInfluence } from "@/hooks/use-expert-influence";
import { cn } from "@/utils/cn";

function RankList({
  title,
  icon: Icon,
  items,
  accent,
  labelKey,
}: {
  title: string;
  icon: typeof Brain;
  items: Array<{ count: number; label: string }>;
  accent: string;
  labelKey?: string;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className={cn("flex items-center gap-2 text-[13px]", accent)}>
          <Icon className="size-3.5" />
          {title}
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        {!items.length ? (
          <p className="text-[11px] text-zinc-500">Nenhum dado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-zinc-200">
                  <span className="mr-2 text-[10px] text-zinc-600">#{index + 1}</span>
                  {item.label}
                </span>
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {item.count}×
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelContent>
    </Panel>
  );
}

export function ExpertInfluenceView() {
  const { dashboard, loading, error, refresh, INFLUENCE_MODULE_LABELS, INFLUENCE_WARNING_THRESHOLD } =
    useExpertInfluence();

  if (loading) {
    return (
      <div className="space-y-4">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Expert Influence Audit" description={error} />;
  }

  if (!dashboard) {
    return (
      <EmptyState
        title="Sem registros de influência"
        description="Gere conteúdo nos engines para medir o uso do Expert Brain."
      />
    );
  }

  const scoreColor =
    dashboard.averageScore >= INFLUENCE_WARNING_THRESHOLD ? "text-emerald-400" : "text-amber-400";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Mede quanto do Expert Brain é consultado e aplicado em cada geração. Meta: ≥3 frameworks, ≥3
          decision rules, ≥2 success patterns (score ≥ {INFLUENCE_WARNING_THRESHOLD}).
        </p>
        <div className="flex gap-2">
          <Link
            href="/dashboard/expert-brain"
            className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/[0.04]"
          >
            ← Expert Brain
          </Link>
          <ActionButton variant="ghost" onClick={() => void refresh()}>
            <RefreshCw className="size-3.5" />
          </ActionButton>
        </div>
      </div>

      {dashboard.belowTargetCount > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <p className="text-[12px] text-amber-200">
            {dashboard.belowTargetCount} geração(ões) com Influence Score &lt; {INFLUENCE_WARNING_THRESHOLD}.
            Ingeste mais cursos ou enriqueça o Expert Brain.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Influence Score médio"
          value={`${dashboard.averageScore.toFixed(1)}`}
          hint={dashboard.averageScore >= INFLUENCE_WARNING_THRESHOLD ? "Dentro da meta" : "Abaixo da meta"}
        />
        <MetricCard label="Gerações auditadas" value={String(dashboard.totalGenerations)} />
        <MetricCard label="Abaixo da meta" value={String(dashboard.belowTargetCount)} />
        <MetricCard label="Módulos ativos" value={String(dashboard.topModules.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankList
          title="Top Frameworks usados"
          icon={Brain}
          accent="text-violet-400"
          items={dashboard.topFrameworks.map((f) => ({ count: f.count, label: f.name }))}
        />
        <RankList
          title="Top Decision Rules"
          icon={Target}
          accent="text-sky-400"
          items={dashboard.topDecisionRules.map((r) => ({ count: r.count, label: r.title }))}
        />
        <RankList
          title="Top Success Patterns"
          icon={TrendingUp}
          accent="text-emerald-400"
          items={dashboard.topSuccessPatterns.map((p) => ({ count: p.count, label: p.title }))}
        />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2 text-[13px]">
            <BarChart3 className="size-3.5 text-cyan-400" />
            Módulos mais influenciados
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          {!dashboard.topModules.length ? (
            <p className="text-[11px] text-zinc-500">Nenhum módulo registrado.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.topModules.map((mod) => (
                <div
                  key={mod.module}
                  className="flex items-center justify-between rounded-md border border-white/[0.06] px-3 py-2"
                >
                  <div>
                    <p className="text-[12px] font-medium text-zinc-100">
                      {INFLUENCE_MODULE_LABELS[mod.module] ?? mod.module}
                    </p>
                    <p className="text-[10px] text-zinc-500">{mod.count} gerações</p>
                  </div>
                  <span
                    className={cn(
                      "text-[13px] font-semibold",
                      mod.averageScore >= INFLUENCE_WARNING_THRESHOLD
                        ? "text-emerald-400"
                        : "text-amber-400"
                    )}
                  >
                    {mod.averageScore.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle className="text-[13px]">Gerações recentes</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="space-y-1.5">
            {dashboard.recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/[0.02]"
              >
                <div>
                  <p className="text-[12px] text-zinc-200">
                    {INFLUENCE_MODULE_LABELS[log.moduleName] ?? log.moduleName}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {log.belowTarget && (
                    <AlertTriangle className="size-3 text-amber-400" />
                  )}
                  <span
                    className={cn(
                      "text-[12px] font-medium",
                      log.belowTarget ? "text-amber-400" : "text-emerald-400"
                    )}
                  >
                    {log.influenceScore.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
