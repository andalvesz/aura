"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
  Rocket,
  Route,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { ActionButton } from "@/components/dashboard/action-button";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type {
  BusinessReasoningSummary,
  OpportunityComparisonEntry,
  OpportunityRecommendation,
  RealityEngineSummary,
  RecommendationSummary,
} from "@/lib/opportunity/opportunity-types";

export type OpportunityRecommendationExperienceProps = {
  opportunities: OpportunityRecommendation[];
  reasoning: BusinessReasoningSummary | null;
  reality: RealityEngineSummary | null;
  comparison: OpportunityComparisonEntry[];
  recommendationSummary: RecommendationSummary | null;
  onCreateMission: () => void | Promise<void>;
  creatingMission?: boolean;
};

function formatBrl(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

function formatRevenueRange(primary: OpportunityRecommendation): string {
  const min = Math.round(primary.price * 2);
  const max = Math.max(primary.estimatedProfit, Math.round(primary.price * 5));
  return `${formatBrl(min)}–${formatBrl(max)}`;
}

function ScoreBar({ label, value, accent = "bg-emerald-500/70" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06]">
        <div className={`h-1 rounded-full ${accent}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function RecommendationHero({
  primary,
  reality,
  recommendationSummary,
  onCreateMission,
  creatingMission,
}: {
  primary: OpportunityRecommendation;
  reality: RealityEngineSummary | null;
  recommendationSummary: RecommendationSummary | null;
  onCreateMission: () => void | Promise<void>;
  creatingMission?: boolean;
}) {
  const warning =
    reality?.realityChecks.find((c) => c.severity === "block" || c.severity === "warning") ??
    (recommendationSummary?.avoidOptionZ ? { message: recommendationSummary.avoidOptionZ } : null);

  const metaMilestone =
    reality?.evolutionPlan.find((p) => p.label === "30 dias")?.milestone ?? "Conseguir 3 clientes pagantes";

  const headline = `Comece oferecendo ${primary.recommendedProduct.toLowerCase()}.`;

  return (
    <Panel className="border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-transparent">
      <PanelContent className="space-y-6 py-6">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-widest text-emerald-400/80">
            Minha recomendação
          </p>
          <h2 className="text-xl font-semibold leading-snug text-zinc-50 sm:text-2xl">{headline}</h2>
          {warning ? (
            <p className="text-[13px] leading-relaxed text-amber-200/90">{warning.message}</p>
          ) : null}
          {primary.decisionExplanation ? (
            <p className="text-[13px] leading-relaxed text-zinc-400">{primary.decisionExplanation}</p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Meta</p>
            <p className="mt-1 text-[13px] font-medium text-zinc-100">{metaMilestone}</p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Prazo</p>
            <p className="mt-1 text-[13px] font-medium text-zinc-100">30 dias</p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Receita esperada</p>
            <p className="mt-1 text-[13px] font-medium text-emerald-300">{formatRevenueRange(primary)}</p>
          </div>
        </div>

        <ActionButton
          variant="primary"
          className="w-full gap-2 py-3 text-[13px] font-semibold uppercase tracking-wide sm:w-auto"
          onClick={() => void onCreateMission()}
          disabled={creatingMission}
        >
          {creatingMission ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          Criar esta missão
        </ActionButton>
      </PanelContent>
    </Panel>
  );
}

function WhySection({
  primary,
  reality,
  reasoning,
}: {
  primary: OpportunityRecommendation;
  reality: RealityEngineSummary | null;
  reasoning: BusinessReasoningSummary | null;
}) {
  const bullets = [
    reality
      ? `Capital disponível: ${formatBrl(reality.profile.availableCapital)}`
      : null,
    reality ? `Tempo disponível: ${reality.profile.timeHoursPerDay}h por dia` : null,
    reasoning
      ? `Objetivo financeiro: ${formatBrl(reasoning.financialGoal.monthlyRevenue)}/mês`
      : reality
        ? `Objetivo financeiro: ${formatBrl(reality.profile.financialGoal)}/mês`
        : null,
    `Modelo com maior chance de sucesso: ${primary.businessModel}`,
    `Menor risco: geração de caixa em ${primary.constraints.cashGenerationSpeed}% vs modelos complexos`,
  ].filter((item): item is string => Boolean(item));

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2 text-[13px]">
          <Lightbulb className="size-3.5 text-sky-400" />
          Por que estou recomendando isso?
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        <ul className="space-y-2">
          {bullets.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[12px] text-zinc-300">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-sky-400/80" />
              {item}
            </li>
          ))}
        </ul>
      </PanelContent>
    </Panel>
  );
}

function EvolutionTimeline({ reality }: { reality: RealityEngineSummary }) {
  const phases = reality.pathRecommendation;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Route className="size-3.5 text-emerald-400" />
          Plano de evolução
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[640px] items-start gap-0">
            {phases.map((phase, index) => (
              <div key={phase.horizon} className="flex flex-1 items-start">
                <div className="flex flex-1 flex-col items-center px-2 text-center">
                  <div className="flex size-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold text-emerald-400">
                    {index + 1}
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-emerald-300">{phase.horizon}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">{phase.recommendation}</p>
                  <span className="mt-2 rounded bg-white/[0.04] px-2 py-0.5 text-[9px] text-zinc-400">
                    {phase.model}
                  </span>
                </div>
                {index < phases.length - 1 ? (
                  <div className="mt-4 hidden h-px w-full min-w-[24px] flex-1 bg-gradient-to-r from-emerald-500/40 to-emerald-500/10 sm:block" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </PanelContent>
    </Panel>
  );
}

function RealityCheckPanel({ reality }: { reality: RealityEngineSummary }) {
  const severityStyles = {
    info: "border-sky-500/20 bg-sky-500/5",
    warning: "border-amber-500/25 bg-amber-500/5",
    block: "border-red-500/25 bg-red-500/5",
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Shield className="size-3.5 text-amber-400" />
          Reality Check
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500">
            Reality Score: <span className="font-medium text-amber-400">{reality.realityScore}</span>
          </p>
          <p className="text-[11px] text-zinc-500">
            Capital {formatBrl(reality.profile.availableCapital)} · {reality.profile.timeHoursPerDay}h/dia
          </p>
        </div>
        {reality.realityChecks.map((check) => (
          <div
            key={check.constraint}
            className={`rounded-md border px-3 py-2.5 ${severityStyles[check.severity]}`}
          >
            <p className="text-[12px] leading-relaxed text-zinc-300">{check.message}</p>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

function OpportunityDetailCard({ rank, item }: { rank: number; item: OpportunityRecommendation }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2 text-[12px]">
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
            {rank}
          </span>
          <Sparkles className="size-3.5 text-emerald-400" />
          {item.title}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3">
        <p className="text-[11px] text-zinc-400">{item.decisionExplanation}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <ScoreBar label="Demanda" value={item.opportunityScore.demand} />
          <ScoreBar label="Ticket" value={item.opportunityScore.ticket} />
        </div>
        <div className="rounded-md border border-red-500/10 bg-red-500/5 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="size-3" />
            Riscos
          </p>
          <ul className="space-y-0.5">
            {item.risks.map((r) => (
              <li key={r} className="text-[10px] text-zinc-300">
                · {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-[10px] text-zinc-500">MVP</p>
            <p className="text-[11px] text-zinc-300">{item.firstMvp}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500">Primeira venda</p>
            <p className="text-[11px] text-zinc-300">{item.firstSalePlan}</p>
          </div>
        </div>
      </PanelContent>
    </Panel>
  );
}

function ComparisonPanel({
  comparison,
  opportunities,
}: {
  comparison: OpportunityComparisonEntry[];
  opportunities: OpportunityRecommendation[];
}) {
  const labelStyles: Record<OpportunityComparisonEntry["label"], string> = {
    recomendada: "border-emerald-500/25 bg-emerald-500/5",
    alternativa: "border-amber-500/25 bg-amber-500/5",
    evitar: "border-zinc-500/25 bg-zinc-500/5",
  };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Lightbulb className="size-3.5 text-violet-400" />
          Comparativo TOP 3
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3">
        {comparison.map((entry) => {
          const opp = opportunities[entry.rank - 1];
          return (
            <div key={entry.rank} className={`rounded-md border px-4 py-3 ${labelStyles[entry.label]}`}>
              <p className="text-[12px] font-medium text-zinc-100">
                Opção {entry.rank} — {entry.businessModel}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">{entry.verdict}</p>
              {opp ? (
                <p className="mt-2 text-[10px] text-zinc-500">
                  Investimento: {formatBrl(opp.estimatedInvestment)} · Validação: {opp.estimatedValidationTime}
                </p>
              ) : null}
            </div>
          );
        })}
      </PanelContent>
    </Panel>
  );
}

function BusinessPathPanel({ reality }: { reality: RealityEngineSummary }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Route className="size-3.5 text-emerald-400" />
          Business Path
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-2">
        {reality.businessPath.map((step, index) => (
          <div key={step.phase} className="flex items-start gap-3">
            <span className="text-[10px] text-zinc-600">{index > 0 ? "↓" : ""}</span>
            <div className="flex-1 border-b border-white/[0.04] pb-2">
              <p className="text-[11px] font-medium text-zinc-300">{step.phase}</p>
              <p className="text-[11px] text-zinc-500">{step.action}</p>
            </div>
          </div>
        ))}
      </PanelContent>
    </Panel>
  );
}

function IntentDetailsPanel({ reasoning }: { reasoning: BusinessReasoningSummary }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Target className="size-3.5 text-sky-400" />
          Detalhes completos
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3">
        <p className="text-[12px] text-zinc-400">{reasoning.businessModelJustification}</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Problema</p>
            <p className="text-[12px] text-zinc-200">{reasoning.primaryProblem}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Mercado</p>
            <p className="text-[12px] text-zinc-200">{reasoning.market ?? "—"}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Tecnologia</p>
            <p className="text-[12px] text-zinc-200">{reasoning.technology ?? "—"}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Modelo</p>
            <p className="text-[12px] text-sky-300">{reasoning.recommendedBusinessModel}</p>
          </div>
        </div>
      </PanelContent>
    </Panel>
  );
}

function ConsultantSummaryPanel({ summary }: { summary: RecommendationSummary }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <TrendingUp className="size-3.5 text-emerald-400" />
          Recomendação do consultor
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        <p className="text-[13px] leading-relaxed text-zinc-200">{summary.narrative}</p>
      </PanelContent>
    </Panel>
  );
}

export function OpportunityRecommendationExperience({
  opportunities,
  reasoning,
  reality,
  comparison,
  recommendationSummary,
  onCreateMission,
  creatingMission,
}: OpportunityRecommendationExperienceProps) {
  const [expanded, setExpanded] = useState(false);
  const primary = opportunities[0];

  if (!primary) return null;

  return (
    <div className="space-y-4">
      <RecommendationHero
        primary={primary}
        reality={reality}
        recommendationSummary={recommendationSummary}
        onCreateMission={onCreateMission}
        creatingMission={creatingMission}
      />

      <WhySection primary={primary} reality={reality} reasoning={reasoning} />

      {reality ? <EvolutionTimeline reality={reality} /> : null}

      <div className="flex justify-center pt-1">
        <ActionButton
          variant="ghost"
          className="gap-2 text-[12px] text-zinc-400"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {expanded ? "Ocultar análise completa" : "Ver análise completa"}
        </ActionButton>
      </div>

      {expanded ? (
        <div className="space-y-4 border-t border-white/[0.06] pt-4">
          {reality ? <RealityCheckPanel reality={reality} /> : null}

          <div className="space-y-3">
            <h3 className="text-[12px] font-medium text-zinc-400">TOP 3 oportunidades</h3>
            <div className="grid gap-3 lg:grid-cols-3">
              {opportunities.map((item, index) => (
                <OpportunityDetailCard key={`${item.niche}-${index}`} rank={index + 1} item={item} />
              ))}
            </div>
          </div>

          {comparison.length > 0 ? (
            <ComparisonPanel comparison={comparison} opportunities={opportunities} />
          ) : null}

          {reality ? <BusinessPathPanel reality={reality} /> : null}

          {reasoning ? <IntentDetailsPanel reasoning={reasoning} /> : null}

          {recommendationSummary ? (
            <ConsultantSummaryPanel summary={recommendationSummary} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
