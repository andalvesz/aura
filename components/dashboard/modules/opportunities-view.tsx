"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Hammer,
  Layers,
  Lightbulb,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useOpportunityEngine } from "@/hooks/use-opportunity-engine";
import { useProductStrategist } from "@/hooks/use-product-strategist";
import { useValidationEngine } from "@/hooks/use-validation-engine";
import type { BusinessReasoningSummary, OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type {
  ProductStrategistResult,
  ProductStrategyRecommendation,
} from "@/lib/product-strategist/product-strategist-types";
import type { ValidationResult } from "@/lib/validation/validation-types";

function ScoreBar({ label, value, accent = "bg-emerald-500/70" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06]">
        <div
          className={`h-1 rounded-full ${accent}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function IntentPanel({ reasoning }: { reasoning: BusinessReasoningSummary }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Target className="size-3.5 text-sky-400" />
          Raciocínio de negócio
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] text-zinc-400">
            {reasoning.businessModelJustification}
          </p>
          <div className="shrink-0 rounded-lg bg-sky-500/10 px-2.5 py-1 text-center">
            <p className="text-[10px] text-zinc-500">Confidence</p>
            <p className="text-lg font-bold text-sky-400">{Math.round(reasoning.confidence)}%</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Problema identificado</p>
            <p className="text-[12px] text-zinc-200">{reasoning.primaryProblem}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Mercado identificado</p>
            <p className="text-[12px] text-zinc-200">{reasoning.market ?? "—"}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Tecnologia identificada</p>
            <p className="text-[12px] text-zinc-200">{reasoning.technology ?? "—"}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Modelo recomendado</p>
            <p className="text-[12px] font-medium text-sky-300">{reasoning.recommendedBusinessModel}</p>
          </div>
        </div>

        {reasoning.avatar || reasoning.problems.length > 1 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {reasoning.avatar ? (
              <div className="rounded-md border border-white/[0.06] px-3 py-2">
                <p className="text-[10px] text-zinc-500">Avatar</p>
                <p className="text-[12px] text-zinc-200">{reasoning.avatar}</p>
              </div>
            ) : null}
            {reasoning.problems.length > 1 ? (
              <div className="rounded-md border border-white/[0.06] px-3 py-2">
                <p className="text-[10px] text-zinc-500">Problemas correlatos</p>
                <p className="text-[12px] text-zinc-200">{reasoning.problems.slice(1).join(" · ")}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </PanelContent>
    </Panel>
  );
}

function OpportunityCard({
  rank,
  item,
  selected,
  onSelect,
}: {
  rank: number;
  item: OpportunityRecommendation;
  selected: boolean;
  onSelect: (item: OpportunityRecommendation) => void;
}) {
  return (
    <Panel className={selected ? "ring-1 ring-emerald-500/30" : undefined}>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-400">
            {rank}
          </span>
          <Sparkles className="size-3.5 text-emerald-400" />
          {item.title}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-zinc-500">Nicho</p>
            <p className="text-[13px] font-medium text-zinc-100">{item.niche}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-center">
            <p className="text-[10px] text-zinc-500">Score final</p>
            <p className="text-lg font-bold text-emerald-400">
              {Math.round(item.opportunityScore.total)}
            </p>
            {item.intentMatchScore > 0 ? (
              <p className="text-[9px] text-zinc-500">Intent {item.intentMatchScore}%</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Produto sugerido</p>
            <p className="text-[12px] text-zinc-200">{item.recommendedProduct}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Preço sugerido</p>
            <p className="text-[12px] font-medium text-zinc-100">
              R$ {item.price.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Lucro estimado</p>
            <p className="text-[12px] font-medium text-emerald-400">
              R$ {item.estimatedProfit.toLocaleString("pt-BR")}/mês
            </p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Modelo de negócio</p>
            <p className="text-[12px] font-medium text-sky-300">{item.businessModel}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <ScoreBar label="Demanda" value={item.opportunityScore.demand} />
          <ScoreBar label="Concorrência" value={item.opportunityScore.competition} />
          <ScoreBar label="Ticket" value={item.opportunityScore.ticket} />
          <ScoreBar label="Produção" value={item.opportunityScore.production} />
        </div>

        <p className="text-[11px] text-zinc-400">{item.reason}</p>

        <ActionButton
          variant={selected ? "primary" : "ghost"}
          className="w-full"
          onClick={() => {
            onSelect(item);
            toast.success(`Oportunidade selecionada: ${item.niche}`);
          }}
        >
          {selected ? "Selecionada" : "Selecionar"}
        </ActionButton>
      </PanelContent>
    </Panel>
  );
}

function ValidationPanel({
  opportunity,
  onValidate,
  loading,
  error,
  validation,
  insights,
}: {
  opportunity: OpportunityRecommendation;
  onValidate: () => void;
  loading: boolean;
  error: string | null;
  validation: ReturnType<typeof useValidationEngine>["validation"];
  insights: ReturnType<typeof useValidationEngine>["insights"];
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-sky-400" />
          Validação — {opportunity.niche}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-4">
        <p className="text-[12px] text-zinc-400">
          Antes de criar qualquer produto, o Aura valida se a oportunidade realmente merece ser construída.
        </p>

        <ActionButton
          variant="primary"
          className="gap-2"
          onClick={onValidate}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
          Validar oportunidade
        </ActionButton>

        {error ? <p className="text-[12px] text-red-400">{error}</p> : null}

        {validation && insights ? (
          <div className="space-y-4 border-t border-white/[0.06] pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {validation.approved ? (
                  <CheckCircle2 className="size-5 text-emerald-400" />
                ) : (
                  <XCircle className="size-5 text-red-400" />
                )}
                <div>
                  <p className="text-[13px] font-medium text-zinc-100">{validation.recommendation}</p>
                  <p className="text-[11px] text-zinc-500">
                    Mínimo exigido: 85 · Resultado: {Math.round(validation.validationScore)}
                  </p>
                </div>
              </div>
              <div
                className={`rounded-lg px-2.5 py-1 text-center ${
                  validation.approved ? "bg-emerald-500/10" : "bg-red-500/10"
                }`}
              >
                <p className="text-[10px] text-zinc-500">Validation Score</p>
                <p
                  className={`text-lg font-bold ${
                    validation.approved ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {Math.round(validation.validationScore)}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <ScoreBar label="Market Confidence" value={validation.marketConfidence} />
              <ScoreBar label="Monetization Potential" value={validation.monetizationPotential} />
              <ScoreBar label="Market Timing" value={validation.marketTiming} />
              <ScoreBar
                label="Competition Risk"
                value={validation.competitionRisk}
                accent="bg-amber-500/70"
              />
              <ScoreBar
                label="Execution Difficulty"
                value={validation.executionDifficulty}
                accent="bg-amber-500/70"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                <p className="mb-2 text-[11px] font-medium text-emerald-400">Pontos fortes</p>
                <ul className="space-y-1">
                  {insights.strengths.map((item) => (
                    <li key={item} className="text-[11px] text-zinc-300">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-amber-500/15 bg-amber-500/5 px-3 py-2">
                <p className="mb-2 text-[11px] font-medium text-amber-400">Pontos fracos</p>
                <ul className="space-y-1">
                  {insights.weaknesses.map((item) => (
                    <li key={item} className="text-[11px] text-zinc-300">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-red-500/15 bg-red-500/5 px-3 py-2">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-red-400">
                  <AlertTriangle className="size-3" />
                  Riscos
                </p>
                <ul className="space-y-1">
                  {insights.risks.map((item) => (
                    <li key={item} className="text-[11px] text-zinc-300">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {validation.reasons.length > 0 ? (
              <div className="rounded-md border border-white/[0.06] px-3 py-2">
                <p className="mb-1 text-[10px] text-zinc-500">Detalhes</p>
                <ul className="space-y-1">
                  {validation.reasons.map((reason) => (
                    <li key={reason} className="text-[11px] text-zinc-300">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </PanelContent>
    </Panel>
  );
}

function StrategyCard({
  strategy,
  selected,
  recommended,
  onSelect,
}: {
  strategy: ProductStrategyRecommendation;
  selected: boolean;
  recommended: boolean;
  onSelect: (strategy: ProductStrategyRecommendation) => void;
}) {
  return (
    <Panel className={selected ? "ring-1 ring-violet-500/30" : undefined}>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-400">
            {strategy.id}
          </span>
          <Lightbulb className="size-3.5 text-violet-400" />
          {strategy.label}
          {recommended ? (
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">
              Recomendada
            </span>
          ) : null}
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3">
        <div>
          <p className="text-[13px] font-medium text-zinc-100">{strategy.strategyName}</p>
          <p className="text-[11px] text-zinc-500">{strategy.reason}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Ticket</p>
            <p className="text-[12px] font-medium text-zinc-100">{strategy.ticketLabel}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Tempo de criação</p>
            <p className="text-[12px] text-zinc-200">{strategy.estimatedLaunchTime} dias</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Margem</p>
            <p className="text-[12px] text-zinc-200">{strategy.estimatedMargin}%</p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Escalabilidade</p>
            <p className="text-[12px] text-zinc-200">{strategy.scalabilityLabel}</p>
          </div>
        </div>

        {strategy.ltvMonths ? (
          <p className="text-[11px] text-zinc-400">LTV estimado: {strategy.ltvMonths} meses</p>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <ScoreBar label="Revenue" value={strategy.scores.revenue} accent="bg-violet-500/70" />
          <ScoreBar label="Execution" value={strategy.scores.execution} accent="bg-violet-500/70" />
          <ScoreBar label="Scalability" value={strategy.scores.scalability} accent="bg-violet-500/70" />
          <ScoreBar label="Speed" value={strategy.scores.speed} accent="bg-violet-500/70" />
          <ScoreBar label="Investment" value={strategy.scores.investment} accent="bg-violet-500/70" />
          <ScoreBar label="Total" value={strategy.scores.total} accent="bg-violet-400" />
        </div>

        <ActionButton
          variant={selected ? "primary" : "ghost"}
          className="w-full"
          onClick={() => onSelect(strategy)}
        >
          {selected ? "Selecionada" : "Selecionar"}
        </ActionButton>
      </PanelContent>
    </Panel>
  );
}

function StrategyComparisonTable({ strategies }: { strategies: ProductStrategyRecommendation[] }) {
  type Row = {
    label: string;
    value: (s: ProductStrategyRecommendation) => string;
  };

  const rows: Row[] = [
    { label: "Ticket", value: (s) => s.ticketLabel },
    { label: "Tempo (dias)", value: (s) => String(s.estimatedLaunchTime) },
    { label: "Margem", value: (s) => `${s.estimatedMargin}%` },
    { label: "Receita est.", value: (s) => `R$ ${s.estimatedRevenue.toLocaleString("pt-BR")}` },
    { label: "ROI", value: (s) => `${s.estimatedROI}x` },
    { label: "Total Score", value: (s) => String(Math.round(s.scores.total)) },
  ];

  return (
    <div className="overflow-x-auto rounded-md border border-white/[0.06]">
      <table className="w-full min-w-[480px] text-left text-[11px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-zinc-500">
            <th className="px-3 py-2 font-medium">Critério</th>
            {strategies.map((s) => (
              <th key={s.id} className="px-3 py-2 font-medium text-zinc-300">
                {s.id} — {s.strategyName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-white/[0.04]">
              <td className="px-3 py-2 text-zinc-500">{row.label}</td>
              {strategies.map((s) => (
                <td key={`${s.id}-${row.label}`} className="px-3 py-2 text-zinc-200">
                  {row.value(s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductStrategistPanel({
  validation,
  strategist,
  selectedStrategy,
  loading,
  error,
  onStrategize,
  onSelectStrategy,
  onBuildProduct,
}: {
  validation: ValidationResult;
  strategist: ProductStrategistResult | null;
  selectedStrategy: ProductStrategyRecommendation | null;
  loading: boolean;
  error: string | null;
  onStrategize: () => void;
  onSelectStrategy: (strategy: ProductStrategyRecommendation) => void;
  onBuildProduct: () => void;
}) {
  if (!validation.approved) return null;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Layers className="size-3.5 text-violet-400" />
          Product Strategist
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-4">
        <p className="text-[12px] text-zinc-400">
          O Aura decide qual formato de produto é mais lucrativo — curso, kit, comunidade ou outro —
          antes de entrar no Product Factory.
        </p>

        <ActionButton
          variant="primary"
          className="gap-2"
          onClick={onStrategize}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Lightbulb className="size-3.5" />}
          Gerar estratégias
        </ActionButton>

        {error ? <p className="text-[12px] text-red-400">{error}</p> : null}

        {strategist ? (
          <div className="space-y-4 border-t border-white/[0.06] pt-4">
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {strategist.strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  selected={selectedStrategy?.id === strategy.id}
                  recommended={strategist.recommendation.id === strategy.id}
                  onSelect={onSelectStrategy}
                />
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium text-zinc-300">Comparativo</p>
              <StrategyComparisonTable strategies={strategist.strategies} />
            </div>

            <div className="rounded-md border border-violet-500/20 bg-violet-500/5 px-4 py-3">
              <p className="mb-1 text-[11px] font-medium text-violet-300">Recomendação do Aura</p>
              <p className="text-[12px] text-zinc-200">{strategist.explanation}</p>
            </div>

            <ActionButton
              variant="primary"
              className="gap-2"
              onClick={onBuildProduct}
              disabled={!selectedStrategy}
            >
              <Hammer className="size-3.5" />
              Construir Produto
            </ActionButton>
          </div>
        ) : null}
      </PanelContent>
    </Panel>
  );
}

export function OpportunitiesView() {
  const router = useRouter();
  const { opportunities, reasoning, loading, error, search } = useOpportunityEngine();
  const {
    validation,
    insights,
    loading: validating,
    error: validationError,
    validate,
    reset: resetValidation,
  } = useValidationEngine();
  const {
    strategist,
    selectedStrategy,
    loading: strategizing,
    error: strategistError,
    strategize,
    selectStrategy,
    reset: resetStrategist,
  } = useProductStrategist();
  const [goal, setGoal] = useState("");
  const [selected, setSelected] = useState<OpportunityRecommendation | null>(null);

  async function handleSearch() {
    resetValidation();
    resetStrategist();
    setSelected(null);
    await search(goal);
  }

  function handleSelect(item: OpportunityRecommendation) {
    setSelected(item);
    resetValidation();
    resetStrategist();
  }

  async function handleValidate() {
    if (!selected) return;
    resetStrategist();
    await validate(selected);
  }

  async function handleStrategize() {
    if (!selected || !validation?.approved) return;
    await strategize(selected, validation);
  }

  function handleBuildProduct() {
    if (!selectedStrategy) return;
    toast.success(`Estratégia escolhida: ${selectedStrategy.strategyName}`);
    router.push("/dashboard/master-flow");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Target className="size-3.5 text-emerald-400" />
            Qual objetivo financeiro?
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
            placeholder="Ex: Quero ganhar R$30.000 por mês"
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/40 focus:outline-none"
          />
          <ActionButton
            variant="primary"
            onClick={() => void handleSearch()}
            disabled={loading || !goal.trim()}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            Buscar oportunidades
          </ActionButton>
          {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
        </PanelContent>
      </Panel>

      {selected ? (
        <Panel>
          <PanelContent className="flex items-center gap-2 py-3">
            <TrendingUp className="size-4 text-emerald-400" />
            <p className="text-[12px] text-zinc-300">
              Selecionado: <span className="font-medium text-zinc-100">{selected.title}</span>
            </p>
          </PanelContent>
        </Panel>
      ) : null}

      {reasoning ? <IntentPanel reasoning={reasoning} /> : null}

      {opportunities.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-[13px] font-medium text-zinc-300">TOP 3 oportunidades</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {opportunities.map((item, index) => (
              <OpportunityCard
                key={`${item.niche}-${index}`}
                rank={index + 1}
                item={item}
                selected={selected?.title === item.title && selected?.niche === item.niche}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {selected ? (
            <>
              <ValidationPanel
                opportunity={selected}
                onValidate={() => void handleValidate()}
                loading={validating}
                error={validationError}
                validation={validation}
                insights={insights}
              />
              {validation?.approved ? (
                <ProductStrategistPanel
                  validation={validation}
                  strategist={strategist}
                  selectedStrategy={selectedStrategy}
                  loading={strategizing}
                  error={strategistError}
                  onStrategize={() => void handleStrategize()}
                  onSelectStrategy={selectStrategy}
                  onBuildProduct={handleBuildProduct}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : !loading && !error ? (
        <EmptyState
          title="Descubra a melhor oportunidade"
          description="Informe sua meta financeira mensal e o Aura recomendará os 3 melhores nichos digitais."
        />
      ) : null}
    </div>
  );
}
