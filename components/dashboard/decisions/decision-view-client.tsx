"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { submitDecisionFeedbackAction } from "@/app/actions/decision-support";
import {
  DECISION_KIND_LABELS,
  DECISION_STATUS_LABELS,
  type DecisionCard,
  type DecisionExplanation,
} from "@/lib/decision-support/types/types";

export function DecisionViewClient({
  card,
  explanation,
}: {
  card: DecisionCard;
  explanation: DecisionExplanation | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4" data-testid="decision-view">
      <div>
        <Link
          href="/dashboard/decisions"
          className="text-[11px] text-zinc-500 hover:text-cyan-300"
        >
          ← Decision Center
        </Link>
        <h1 className="mt-1 text-lg font-medium text-zinc-100">{card.title}</h1>
        <p className="text-[12px] text-zinc-500">
          {DECISION_KIND_LABELS[card.kind]} ·{" "}
          {DECISION_STATUS_LABELS[card.status]} · conf {card.confidence} (
          {card.confidenceBand}) · executionInfluence: none
        </p>
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Resumo</h2>
        <p className="mt-1 text-[13px] text-zinc-400">{card.summary}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Contexto</h2>
        <p className="mt-1 text-[13px] text-zinc-400">{card.context}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Por que apareceu
        </h2>
        <p className="mt-1 text-[13px] text-zinc-400">
          {explanation?.whyAppeared ?? card.whyAppeared}
        </p>
        <p className="mt-2 text-[12px] text-zinc-500">{card.explanation}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Evidências</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {card.evidence.map((e) => (
            <li key={e.id}>
              <span className="text-zinc-500">
                [{e.sourceLayer}/{e.sourceType}]
              </span>{" "}
              {e.summary} · conf {e.confidence}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <RelationBlock
          title="Projetos"
          ids={card.relatedProjectIds}
          href={(id) => `/dashboard/projects/${id}`}
        />
        <RelationBlock
          title="Empresas"
          ids={card.relatedBusinessIds}
          href={() => "/dashboard/business"}
        />
        <RelationBlock
          title="Documentos"
          ids={card.relatedDocumentIds}
          href={(id) => `/dashboard/knowledge/${id}`}
        />
        <RelationBlock
          title="Discovery"
          ids={card.relatedDiscoveryIds}
          href={() => "/dashboard/discovery"}
        />
        <RelationBlock
          title="Memórias"
          ids={card.relatedMemoryIds}
          href={(id) => `/dashboard/settings/memory#${id}`}
        />
        <RelationBlock
          title="Entidades (World)"
          ids={card.relatedEntityIds}
          href={() => "/dashboard/settings/world-model"}
        />
      </div>

      {card.tradeoff ? (
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">Trade-off</h2>
          <div className="mt-2 grid gap-2 text-[12px] sm:grid-cols-2">
            <div>
              <p className="text-emerald-300/80">Vantagens</p>
              <ul className="text-zinc-400">
                {card.tradeoff.advantages.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-rose-300/80">Desvantagens</p>
              <ul className="text-zinc-400">
                {card.tradeoff.disadvantages.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-amber-300/80">Riscos</p>
              <ul className="text-zinc-400">
                {card.tradeoff.risks.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-zinc-300">Incertezas</p>
              <ul className="text-zinc-400">
                {card.tradeoff.uncertainties.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Alternativas</h2>
        <ul className="mt-2 space-y-2">
          {card.alternativeOptions.map((a) => (
            <li
              key={a.id}
              className="rounded border border-white/[0.04] p-2 text-[12px]"
            >
              <p className="text-zinc-200">{a.title}</p>
              <p className="text-zinc-500">{a.summary}</p>
              <p className="mt-1 text-[10px] text-emerald-500/70">
                + {a.pros.join("; ")}
              </p>
              <p className="text-[10px] text-rose-400/70">
                − {a.cons.join("; ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Limitações</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-500">
          {card.limitations.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Métricas</h2>
        <p className="mt-1 text-[12px] text-zinc-400">
          Impacto {card.impact} · Urgência {card.urgency} · Esforço{" "}
          {card.effort} · Reversibilidade {card.reversibility}
        </p>
        <p className="text-[11px] text-zinc-600">
          Engine: {card.engineId} · fingerprint: {card.fingerprint}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["accept", "Aceitar sugestão"],
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
                const res = await submitDecisionFeedbackAction({
                  decisionId: card.id,
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
    <div className="rounded-lg border border-white/[0.06] p-3">
      <h3 className="text-[12px] font-medium text-zinc-300">{title}</h3>
      <ul className="mt-1 space-y-1 text-[12px] text-zinc-500">
        {ids.length ? (
          ids.map((id) => (
            <li key={id}>
              <Link href={href(id)} className="hover:text-cyan-300">
                {id}
              </Link>
            </li>
          ))
        ) : (
          <li className="text-zinc-600">Nenhum</li>
        )}
      </ul>
    </div>
  );
}
