"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { submitPriorityFeedbackAction } from "@/app/actions/prioritization";
import {
  PRIORITY_KIND_LABELS,
  PRIORITY_STATUS_LABELS,
  type PriorityExplanation,
  type PriorityItem,
} from "@/lib/prioritization/types/types";
import { SCORE_WEIGHTS } from "@/lib/prioritization/ranking";

export function PriorityViewClient({
  item,
  explanation,
}: {
  item: PriorityItem;
  explanation: PriorityExplanation | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4" data-testid="priority-view">
      <div>
        <Link
          href="/dashboard/priorities"
          className="text-[11px] text-zinc-500 hover:text-cyan-300"
        >
          ← Priority Center
        </Link>
        <h1 className="mt-1 text-lg font-medium text-zinc-100">{item.title}</h1>
        <p className="text-[12px] text-zinc-500">
          {PRIORITY_KIND_LABELS[item.kind]} ·{" "}
          {PRIORITY_STATUS_LABELS[item.status]} · score {item.priorityScore}
          {item.ranking != null ? ` · rank #${item.ranking}` : ""} · conf{" "}
          {item.confidence} ({item.confidenceBand}) · executionInfluence: none
        </p>
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Resumo</h2>
        <p className="mt-1 text-[13px] text-zinc-400">{item.summary}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Por que merece atenção
        </h2>
        <p className="mt-1 text-[13px] text-zinc-400">
          {explanation?.whyAppeared ?? item.attentionReason}
        </p>
        <p className="mt-2 text-[12px] text-zinc-500">{item.explanation}</p>
      </section>

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
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
          <span>impacto {item.impact}</span>
          <span>urgência {item.urgency}</span>
          <span>esforço {item.effort}</span>
          <span>reversibilidade {item.reversibility}</span>
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Critérios</h2>
        <ul className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {(explanation?.criteriaContributed ?? item.criteriaContributed).map(
            (c) => (
              <li
                key={c}
                className="rounded border border-white/10 px-2 py-0.5 text-zinc-400"
              >
                {c}
              </li>
            )
          )}
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
          Dados faltantes
        </h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {(explanation?.missingData ?? item.missingData).length ? (
            (explanation?.missingData ?? item.missingData).map((m) => (
              <li key={m}>· {m}</li>
            ))
          ) : (
            <li className="text-zinc-600">Nenhuma lacuna listada</li>
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Visões alternativas
        </h2>
        <ul className="mt-2 space-y-2 text-[12px] text-zinc-400">
          {item.alternativeViews.map((a) => (
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
          title="Knowledge"
          ids={item.relatedDocumentIds}
          href={(id) => `/dashboard/knowledge/${id}`}
        />
        <RelationBlock
          title="Empresas"
          ids={item.relatedBusinessIds}
          href={() => "/dashboard/business"}
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

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["confirm", "Confirmar prioridade"],
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
                const res = await submitPriorityFeedbackAction({
                  priorityId: item.id,
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
