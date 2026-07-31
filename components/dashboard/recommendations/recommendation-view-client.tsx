"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitRecommendationFeedbackAction } from "@/app/actions/recommendation";
import {
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_TYPE_LABELS,
  type RecommendationCard,
  type RecommendationExplanation,
} from "@/lib/recommendation/types/types";
import { SCORE_WEIGHTS } from "@/lib/recommendation/ranking";

export function RecommendationViewClient({
  item,
  explanation,
}: {
  item: RecommendationCard;
  explanation: RecommendationExplanation | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showPipeline, setShowPipeline] = useState(false);

  return (
    <div className="space-y-4" data-testid="recommendation-view">
      <div>
        <Link
          href="/dashboard/recommendations"
          className="text-[11px] text-zinc-500 hover:text-cyan-300"
        >
          ← Recommendation Center
        </Link>
        <h1 className="mt-1 text-lg font-medium text-zinc-100">{item.title}</h1>
        <p className="text-[12px] text-zinc-500">
          {RECOMMENDATION_TYPE_LABELS[item.recommendationType]} ·{" "}
          {RECOMMENDATION_STATUS_LABELS[item.status]} · score{" "}
          {item.priorityScore}
          {item.ranking != null ? ` · rank #${item.ranking}` : ""} · conf{" "}
          {item.confidence} ({item.confidenceBand}) · executionInfluence: none
        </p>
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Resumo</h2>
        <p className="mt-1 text-[13px] text-zinc-400">{item.summary}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Contexto</h2>
        <p className="mt-1 text-[13px] text-zinc-400">
          {explanation?.whyAppeared ?? item.reasoning.whyAppeared}
        </p>
        <p className="mt-2 text-[12px] text-zinc-500">{item.explanation}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Razões</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          <li>
            Critérios:{" "}
            {(
              explanation?.criteriaWeighted ?? item.reasoning.criteriaWeighted
            ).join(", ")}
          </li>
          <li>
            Evidências usadas:{" "}
            {(
              explanation?.evidenceSummaries ?? item.reasoning.evidenceUsed
            ).join(" · ")}
          </li>
        </ul>
      </section>

      {item.conflicts.length ? (
        <section
          className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3"
          data-testid="recommendation-conflicts"
        >
          <h2 className="text-[12px] font-medium text-amber-200">
            Contradições
          </h2>
          <p className="mt-1 text-[11px] text-amber-200/70">
            Ambas as recomendações são mantidas — o Aura não escolhe
            automaticamente.
          </p>
          <ul className="mt-2 space-y-2 text-[12px] text-amber-100/80">
            {item.conflicts.map((c) => (
              <li key={c.conflictingRecommendationId}>
                {c.conflictSummary}
                <span className="mt-0.5 block text-[10px] text-amber-200/50">
                  Fontes compartilhadas: {c.sharedSourceIds.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Score transparente
        </h2>
        <p className="mt-1 text-[11px] text-zinc-600">
          Pesos: impact×{SCORE_WEIGHTS.impact} · urgency×{SCORE_WEIGHTS.urgency}{" "}
          · conf×{SCORE_WEIGHTS.confidence} · effort×{SCORE_WEIGHTS.effort} ·
          rev×{SCORE_WEIGHTS.reversibility} · recency×{SCORE_WEIGHTS.recency} ·
          completeness×{SCORE_WEIGHTS.completeness}
        </p>
        <ul className="mt-2 grid gap-1 text-[12px] text-zinc-400 sm:grid-cols-2">
          <li>Impacto: {item.scoreBreakdown.impact}</li>
          <li>Urgência: {item.scoreBreakdown.urgency}</li>
          <li>Confiança: {item.scoreBreakdown.confidence}</li>
          <li>Esforço: {item.scoreBreakdown.effort}</li>
          <li>Reversibilidade: {item.scoreBreakdown.reversibility}</li>
          <li>Recência: {item.scoreBreakdown.recency}</li>
          <li>Completude: {item.scoreBreakdown.completeness}</li>
          <li className="text-zinc-200">Total: {item.scoreBreakdown.total}</li>
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Evidências</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {item.evidence.map((e) => (
            <li key={e.id}>
              <span className="text-zinc-500">
                [{e.sourceLayer}/{e.sourceType}]
              </span>{" "}
              {e.summary} · conf {e.confidence}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Limitações</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {(explanation?.limitations ?? item.limitations).map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Informações faltantes
        </h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {(
            explanation?.missingInformation ??
            item.reasoning.missingInformation
          ).length ? (
            (
              explanation?.missingInformation ??
              item.reasoning.missingInformation
            ).map((m) => <li key={m}>· {m}</li>)
          ) : (
            <li className="text-zinc-600">Nenhuma lacuna listada</li>
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Alternativas</h2>
        <ul className="mt-2 space-y-2 text-[12px] text-zinc-400">
          {item.alternatives.map((a) => (
            <li key={a.id}>
              <span className="text-zinc-300">{a.title}</span> — {a.summary}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <RelationBlock
          title="Projeto"
          ids={item.relatedProject ? [item.relatedProject] : []}
          href={(id) => `/dashboard/projects/${id}`}
        />
        <RelationBlock
          title="Discovery"
          ids={item.relatedDiscovery ? [item.relatedDiscovery] : []}
          href={() => "/dashboard/discovery"}
        />
        <RelationBlock
          title="Decision"
          ids={item.relatedDecision ? [item.relatedDecision] : []}
          href={(id) => `/dashboard/decisions/${id}`}
        />
        <RelationBlock
          title="Scenario"
          ids={item.relatedScenario ? [item.relatedScenario] : []}
          href={(id) => `/dashboard/scenarios/${id}`}
        />
        <RelationBlock
          title="Prioridade"
          ids={item.relatedPriority ? [item.relatedPriority] : []}
          href={(id) => `/dashboard/priorities/${id}`}
        />
        <RelationBlock
          title="Documentos"
          ids={item.relatedDocumentIds}
          href={(id) => `/dashboard/knowledge/${id}`}
        />
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Timeline</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          <li>Criado: {item.createdAt.slice(0, 19).replace("T", " ")}</li>
          <li>Atualizado: {item.updatedAt.slice(0, 19).replace("T", " ")}</li>
          {item.signalObservedAt ? (
            <li>
              Sinal observado:{" "}
              {item.signalObservedAt.slice(0, 19).replace("T", " ")}
            </li>
          ) : null}
          {item.lastReviewedAt ? (
            <li>
              Última revisão:{" "}
              {item.lastReviewedAt.slice(0, 19).replace("T", " ")}
            </li>
          ) : null}
        </ul>
      </section>

      <div>
        <button
          type="button"
          data-testid="recommendation-explain-btn"
          className="min-h-11 rounded border border-cyan-500/30 px-3 text-[12px] text-cyan-200"
          onClick={() => setShowPipeline((v) => !v)}
        >
          Como o Aura chegou nessa recomendação?
        </button>
        {showPipeline ? (
          <section
            className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3"
            data-testid="recommendation-pipeline"
          >
            <h2 className="text-[12px] font-medium text-cyan-200">
              Pipeline completo
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] text-zinc-400">
              {(explanation?.pipelineSteps ?? item.pipelineSteps).map(
                (step) => (
                  <li key={step}>{step}</li>
                )
              )}
            </ol>
            <p className="mt-2 text-[11px] text-zinc-600">
              executionInfluence: none · somente leitura · sem Planner
            </p>
          </section>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["accept", "Aceitar recomendação"],
            ["ignore", "Ignorar"],
            ["archive", "Arquivar"],
            ["request_review", "Solicitar revisão"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            disabled={pending}
            className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
            onClick={() => {
              start(async () => {
                const res = await submitRecommendationFeedbackAction({
                  recommendationId: item.id,
                  kind,
                });
                if (res.error) toast.error(res.error);
                else {
                  toast.success(label);
                  router.refresh();
                }
              });
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RelationBlock({
  title,
  ids,
  href,
}: {
  title: string;
  ids: string[];
  href: (id: string) => string;
}) {
  return (
    <section className="rounded-lg border border-white/[0.06] p-3">
      <h2 className="text-[12px] font-medium text-zinc-300">{title}</h2>
      {!ids.length ? (
        <p className="mt-1 text-[11px] text-zinc-600">—</p>
      ) : (
        <ul className="mt-1 space-y-1 text-[11px]">
          {ids.map((id) => (
            <li key={id}>
              <Link
                href={href(id)}
                className="text-zinc-400 hover:text-cyan-300"
              >
                {id}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
