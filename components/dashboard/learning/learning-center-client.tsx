"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  confirmLearningProposalAction,
  rejectLearningProposalAction,
  applyLearningProposalAction,
  revertLearningProposalAction,
  runLearningCycleAction,
  archiveLearningProposalAction,
} from "@/app/actions/learning";
import type { LearningProposal } from "@/lib/learning";

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "Aguardando confirmação",
  GENERATED: "Gerada",
  CONFIRMED: "Confirmada",
  APPLIED: "Aplicada",
  EVALUATING: "Em avaliação",
  SUCCESSFUL: "Bem-sucedida",
  UNSUCCESSFUL: "Sem benefício",
  REJECTED: "Rejeitada",
  REVERTED: "Revertida",
  ARCHIVED: "Arquivada",
};

export function LearningCenterClient({
  initial,
}: {
  initial: LearningProposal[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<string>("all");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const filtered =
    filter === "all"
      ? items
      : items.filter((i) => {
          if (filter === "pending")
            return i.status === "PENDING_REVIEW" || i.status === "GENERATED";
          if (filter === "applied")
            return ["APPLIED", "EVALUATING", "SUCCESSFUL", "UNSUCCESSFUL"].includes(
              i.status
            );
          if (filter === "rejected") return i.status === "REJECTED";
          if (filter === "reverted") return i.status === "REVERTED";
          if (filter === "archived") return i.status === "ARCHIVED";
          if (filter === "evaluating") return i.status === "EVALUATING";
          return true;
        });

  function refresh(next: LearningProposal[]) {
    setItems(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4" data-testid="learning-center">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Aura Brain
        </p>
        <h1 className="text-lg font-medium text-zinc-100">Learning Center</h1>
        <p className="text-[12px] text-zinc-500">
          Observações e propostas revisáveis. Nenhuma mudança silenciosa.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={pending}
            className="rounded border border-cyan-500/30 px-3 py-1.5 text-[12px] text-cyan-100"
            onClick={() =>
              start(async () => {
                const res = await runLearningCycleAction();
                setMessage(
                  `Ciclo: ${res.patternsDetected} padrões, ${res.proposalsGenerated} propostas`
                );
                router.refresh();
              })
            }
          >
            Rodar ciclo (AUTO_OBSERVE)
          </button>
          <Link
            href="/dashboard"
            className="rounded border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400"
          >
            Aura Home
          </Link>
        </div>
        {message ? (
          <p className="text-[11px] text-zinc-500">{message}</p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-1">
        {[
          ["all", "Todas"],
          ["pending", "Aguardando"],
          ["evaluating", "Em avaliação"],
          ["applied", "Aplicadas"],
          ["rejected", "Rejeitadas"],
          ["reverted", "Revertidas"],
          ["archived", "Arquivadas"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded px-2 py-1 text-[11px] ${
              filter === id
                ? "bg-violet-500/20 text-violet-100"
                : "text-zinc-500 hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {filtered.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/dashboard/learning/${p.id}`}
                  className="text-[13px] font-medium text-zinc-100 hover:text-cyan-300"
                >
                  {p.title}
                </Link>
                <p className="mt-1 text-[12px] text-zinc-500">{p.summary}</p>
                <p className="mt-1 text-[10px] text-zinc-600">
                  {STATUS_LABELS[p.status] ?? p.status} · {p.scope} · confiança{" "}
                  {(p.confidence * 100).toFixed(0)}% · amostra {p.sampleSize}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {(p.status === "PENDING_REVIEW" || p.status === "GENERATED") && (
                  <>
                    <button
                      type="button"
                      className="rounded border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-100"
                      onClick={() =>
                        start(async () => {
                          const r = await confirmLearningProposalAction(p.id);
                          if (r.proposal)
                            refresh(
                              items.map((i) => (i.id === p.id ? r.proposal! : i))
                            );
                          setMessage(r.error);
                        })
                      }
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-400"
                      onClick={() =>
                        start(async () => {
                          const r = await rejectLearningProposalAction(p.id);
                          if (r.proposal)
                            refresh(
                              items.map((i) => (i.id === p.id ? r.proposal! : i))
                            );
                        })
                      }
                    >
                      Rejeitar
                    </button>
                  </>
                )}
                {p.status === "CONFIRMED" && (
                  <button
                    type="button"
                    className="rounded border border-cyan-500/30 px-2 py-1 text-[11px] text-cyan-100"
                    onClick={() =>
                      start(async () => {
                        const r = await applyLearningProposalAction(p.id);
                        if (r.proposal)
                          refresh(
                            items.map((i) => (i.id === p.id ? r.proposal! : i))
                          );
                        setMessage(r.error);
                      })
                    }
                  >
                    Aplicar
                  </button>
                )}
                {["APPLIED", "EVALUATING", "SUCCESSFUL", "UNSUCCESSFUL"].includes(
                  p.status
                ) && (
                  <button
                    type="button"
                    className="rounded border border-amber-500/30 px-2 py-1 text-[11px] text-amber-100"
                    onClick={() =>
                      start(async () => {
                        const r = await revertLearningProposalAction(p.id);
                        if (r.proposal)
                          refresh(
                            items.map((i) => (i.id === p.id ? r.proposal! : i))
                          );
                        setMessage(r.error);
                      })
                    }
                  >
                    Reverter
                  </button>
                )}
                <button
                  type="button"
                  className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-500"
                  onClick={() =>
                    start(async () => {
                      await archiveLearningProposalAction(p.id);
                      refresh(
                        items.map((i) =>
                          i.id === p.id ? { ...i, status: "ARCHIVED" } : i
                        )
                      );
                    })
                  }
                >
                  Arquivar
                </button>
              </div>
            </div>
          </li>
        ))}
        {!filtered.length ? (
          <li className="text-[12px] text-zinc-600">
            Nenhuma proposta neste filtro. Rode o ciclo AUTO_OBSERVE.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
