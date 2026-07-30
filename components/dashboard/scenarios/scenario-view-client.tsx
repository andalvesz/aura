"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { submitScenarioFeedbackAction } from "@/app/actions/scenario";
import {
  SCENARIO_STATUS_LABELS,
  SCENARIO_TYPE_LABELS,
  type ScenarioCard,
  type ScenarioExplanation,
} from "@/lib/scenario/types/types";

export function ScenarioViewClient({
  card,
  explanation,
}: {
  card: ScenarioCard;
  explanation: ScenarioExplanation | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4" data-testid="scenario-view">
      <div>
        <Link
          href="/dashboard/scenarios"
          className="text-[11px] text-zinc-500 hover:text-cyan-300"
        >
          ← Scenario Center
        </Link>
        <h1 className="mt-1 text-lg font-medium text-zinc-100">{card.title}</h1>
        <p className="text-[12px] text-zinc-500">
          {SCENARIO_TYPE_LABELS[card.scenarioType]} ·{" "}
          {SCENARIO_STATUS_LABELS[card.status]} · conf {card.confidence} ·
          impacto {card.impact} · executionInfluence: none
        </p>
      </div>

      {card.whatIfPrompt ? (
        <p className="rounded border border-cyan-500/20 px-3 py-2 text-[12px] text-cyan-100/90">
          What-If: {card.whatIfPrompt}
        </p>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Descrição</h2>
        <p className="mt-1 text-[13px] text-zinc-400">{card.description}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Contexto</h2>
        <p className="mt-1 text-[13px] text-zinc-400">{card.context}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Explicação</h2>
        <p className="mt-1 text-[13px] text-zinc-400">
          {explanation?.whyResult ?? card.whyResult}
        </p>
        <div className="mt-2 grid gap-2 text-[12px] sm:grid-cols-2">
          <div>
            <p className="text-zinc-300">Dados utilizados</p>
            <ul className="text-zinc-500">
              {(explanation?.usedData ?? []).map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-zinc-300">Dados ignorados</p>
            <ul className="text-zinc-500">
              {(explanation?.ignoredData ?? card.ignoredData).map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Premissas</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {card.assumptions.map((a) => (
            <li key={a.id}>
              · {a.statement}{" "}
              <span className="text-zinc-600">(conf {a.confidence})</span>
            </li>
          ))}
        </ul>
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
              {!e.used ? " · não usada" : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Linha do tempo
        </h2>
        <ol className="mt-2 space-y-2 text-[12px]">
          {card.timeline.map((t) => (
            <li key={t.id} className="border-l border-white/10 pl-2">
              <p className="text-zinc-200">
                {t.label}{" "}
                <span className="text-[10px] text-zinc-600">{t.phase}</span>
              </p>
              <p className="text-zinc-500">{t.summary}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Incerteza</h2>
        <div className="mt-2 grid gap-2 text-[12px] sm:grid-cols-3">
          <div>
            <p className="text-zinc-300">Hipóteses</p>
            <ul className="text-zinc-500">
              {card.uncertainty.hypotheses.map((h) => (
                <li key={h}>· {h}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-zinc-300">Dados ausentes</p>
            <ul className="text-zinc-500">
              {card.uncertainty.missingData.length ? (
                card.uncertainty.missingData.map((h) => <li key={h}>· {h}</li>)
              ) : (
                <li>· nenhum gap listado</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-zinc-300">Limitações</p>
            <ul className="text-zinc-500">
              {card.uncertainty.limitations.map((h) => (
                <li key={h}>· {h}</li>
              ))}
            </ul>
          </div>
        </div>
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
        <h2 className="text-[12px] font-medium text-zinc-300">
          Cenários alternativos
        </h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {card.alternativeScenarios.map((a) => (
            <li key={a.id}>
              · {a.title}: {a.summary}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 text-[12px]">
        <Rel
          label="Decisão"
          href={
            card.relatedDecisionId
              ? `/dashboard/decisions/${card.relatedDecisionId}`
              : null
          }
          text={card.relatedDecisionId}
        />
        <Rel
          label="Projeto"
          href={
            card.relatedProjectId
              ? `/dashboard/projects/${card.relatedProjectId}`
              : null
          }
          text={card.relatedProjectId}
        />
        <Rel
          label="Discovery"
          href={card.relatedDiscoveryId ? "/dashboard/discovery" : null}
          text={card.relatedDiscoveryId}
        />
        <Rel
          label="Business"
          href={card.relatedBusinessId ? "/dashboard/business" : null}
          text={card.relatedBusinessId}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["save", "Salvar"],
            ["archive", "Arquivar"],
            ["discard", "Descartar"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            disabled={pending}
            className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
            onClick={() => {
              start(async () => {
                const res = await submitScenarioFeedbackAction({
                  scenarioId: card.id,
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

function Rel({
  label,
  href,
  text,
}: {
  label: string;
  href: string | null;
  text: string | null;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] p-3">
      <p className="text-zinc-300">{label}</p>
      {href && text ? (
        <Link href={href} className="text-cyan-300 hover:underline">
          {text}
        </Link>
      ) : (
        <p className="text-zinc-600">—</p>
      )}
    </div>
  );
}
