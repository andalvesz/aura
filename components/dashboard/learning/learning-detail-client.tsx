"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import {
  applyLearningProposalAction,
  confirmLearningProposalAction,
  rejectLearningProposalAction,
  revertLearningProposalAction,
  completeLearningEvaluationAction,
} from "@/app/actions/learning";
import type {
  LearningApplication,
  LearningEvaluation,
  LearningExplanation,
  LearningProposal,
  LearningSignal,
} from "@/lib/learning";

export function LearningDetailClient({
  proposal,
  explanation,
  signals,
  application,
  evaluation,
}: {
  proposal: LearningProposal;
  explanation: LearningExplanation | null;
  signals: LearningSignal[];
  application: LearningApplication | null;
  evaluation: LearningEvaluation | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(proposal);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4" data-testid="learning-detail">
      <Link href="/dashboard/learning" className="text-[12px] text-zinc-500">
        ← Learning Center
      </Link>
      <header>
        <h1 className="text-lg font-medium text-zinc-100">{current.title}</h1>
        <p className="text-[12px] text-zinc-500">{current.summary}</p>
        <p className="mt-1 text-[11px] text-zinc-600">
          {current.status} · {current.scope} · {current.proposalType}
        </p>
      </header>

      <section className="rounded border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Por que o Aura quer aprender isso?
        </h2>
        {explanation ? (
          <div className="mt-2 space-y-2 text-[12px] text-zinc-400 whitespace-pre-wrap">
            <p>{explanation.why}</p>
            <p>Mudança exata: {explanation.exactChange}</p>
            <p>Amostra: {explanation.sampleSize}</p>
            <p>Fontes: {explanation.sources.join(", ") || "—"}</p>
            <p>Regras: {explanation.rules.join(", ")}</p>
            <p>
              Limitações:
              {"\n"}
              {explanation.limitations.join("\n")}
            </p>
            {explanation.counterEvidence.length ? (
              <p>Contraevidências: {explanation.counterEvidence.join("; ")}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-zinc-600">Sem explicação.</p>
        )}
      </section>

      <section className="rounded border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Sinais</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {signals.map((s) => (
            <li key={s.id}>
              {s.signalType} · {s.sourceLayer} · {s.subjectType}/{s.subjectId}
            </li>
          ))}
          {!signals.length ? <li>Nenhum sinal carregado.</li> : null}
        </ul>
      </section>

      <section className="rounded border border-white/[0.06] p-3 text-[12px] text-zinc-400">
        <p>Benefício esperado: {current.expectedBenefit}</p>
        <p>Risco: {current.possibleRisk}</p>
        <p>Componentes: {current.affectedComponents.join(", ")}</p>
        <p>Hash: {current.payloadHash}</p>
        <p>Válido até: {current.validUntil}</p>
      </section>

      {evaluation ? (
        <section className="rounded border border-white/[0.06] p-3 text-[12px] text-zinc-400">
          <h2 className="font-medium text-zinc-300">Avaliação</h2>
          <p>
            Baseline {evaluation.baselineMetric.toFixed(2)} → atual{" "}
            {evaluation.currentMetric.toFixed(2)} · {evaluation.result}
          </p>
        </section>
      ) : null}

      {application ? (
        <section className="rounded border border-white/[0.06] p-3 text-[12px] text-zinc-400">
          <h2 className="font-medium text-zinc-300">Aplicação</h2>
          <p>Em {application.appliedAt.slice(0, 19)}</p>
          {application.revertedAt ? (
            <p>Revertida em {application.revertedAt.slice(0, 19)}</p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2" data-testid="learning-confirmation-card">
        {(current.status === "PENDING_REVIEW" ||
          current.status === "GENERATED") && (
          <>
            <button
              type="button"
              disabled={pending}
              className="rounded border border-emerald-500/40 px-3 py-1.5 text-[12px] text-emerald-100"
              onClick={() =>
                start(async () => {
                  const r = await confirmLearningProposalAction(current.id);
                  if (r.proposal) setCurrent(r.proposal);
                  setError(r.error);
                  router.refresh();
                })
              }
            >
              Confirmar
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
              onClick={() =>
                start(async () => {
                  const r = await rejectLearningProposalAction(current.id);
                  if (r.proposal) setCurrent(r.proposal);
                  setError(r.error);
                  router.refresh();
                })
              }
            >
              Rejeitar / Não aprenda isso
            </button>
          </>
        )}
        {current.status === "CONFIRMED" && (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-cyan-500/40 px-3 py-1.5 text-[12px] text-cyan-100"
            onClick={() =>
              start(async () => {
                const r = await applyLearningProposalAction(current.id);
                if (r.proposal) setCurrent(r.proposal);
                setError(r.error);
                router.refresh();
              })
            }
          >
            Aplicar
          </button>
        )}
        {current.status === "EVALUATING" && (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-violet-500/40 px-3 py-1.5 text-[12px] text-violet-100"
            onClick={() =>
              start(async () => {
                const r = await completeLearningEvaluationAction(
                  current.id,
                  current.confidence + 0.1
                );
                if (r.proposal) setCurrent(r.proposal);
                setError(r.error);
                router.refresh();
              })
            }
          >
            Concluir avaliação
          </button>
        )}
        {["APPLIED", "EVALUATING", "SUCCESSFUL", "UNSUCCESSFUL"].includes(
          current.status
        ) && (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-amber-500/40 px-3 py-1.5 text-[12px] text-amber-100"
            onClick={() =>
              start(async () => {
                const r = await revertLearningProposalAction(current.id);
                if (r.proposal) setCurrent(r.proposal);
                setError(r.error);
                router.refresh();
              })
            }
          >
            Reverter
          </button>
        )}
      </div>
      <p className="text-[10px] text-zinc-600">
        Confirmação server-side com proposalId + payload hash. Texto na conversa
        não aplica.
      </p>
      {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
    </div>
  );
}
