"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  generateDecisionsAction,
  searchDecisionsAction,
  submitDecisionFeedbackAction,
} from "@/app/actions/decision-support";
import {
  DECISION_KIND_LABELS,
  DECISION_STATUS_LABELS,
  type DecisionCard,
  type DecisionKind,
  type DecisionStatus,
} from "@/lib/decision-support/types/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { EmptyState } from "@/components/dashboard/empty-state";

export function DecisionCenterClient({
  initial,
}: {
  initial: DecisionCard[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cards, setCards] = useState(initial);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<DecisionKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | "all">(
    "all"
  );

  const visible = useMemo(() => {
    return cards.filter((c) => {
      if (kindFilter !== "all" && c.kind !== kindFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [cards, kindFilter, statusFilter]);

  return (
    <div className="space-y-4" data-testid="decision-center">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950"
          onClick={() => {
            start(async () => {
              const res = await generateDecisionsAction();
              if (res.error) toast.error(res.error);
              else {
                toast.success(
                  `${res.cards.length} sugestões · validator rejeitou ${res.rejectedCount}`
                );
                router.refresh();
              }
            });
          }}
        >
          Gerar apoio à decisão
        </button>
        <p className="self-center text-[11px] text-zinc-600">
          executionInfluence: none · somente análise
        </p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (query.trim().length < 2) {
              setCards(initial);
              return;
            }
            const hits = await searchDecisionsAction(query.trim());
            setCards(hits);
          });
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar decisões, evidências, limitações…"
          className={FORM_INPUT_CLASS}
          data-testid="decision-search"
        />
        <button
          type="submit"
          className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <select
          value={kindFilter}
          onChange={(e) =>
            setKindFilter(e.target.value as DecisionKind | "all")
          }
          className={FORM_INPUT_CLASS}
        >
          <option value="all">Todos os tipos</option>
          {(Object.keys(DECISION_KIND_LABELS) as DecisionKind[]).map((k) => (
            <option key={k} value={k}>
              {DECISION_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as DecisionStatus | "all")
          }
          className={FORM_INPUT_CLASS}
        >
          <option value="all">Todos os status</option>
          {(Object.keys(DECISION_STATUS_LABELS) as DecisionStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {DECISION_STATUS_LABELS[s]}
              </option>
            )
          )}
        </select>
      </div>

      {!visible.length ? (
        <EmptyState
          title="Nenhuma decisão candidata"
          description="Gere apoio à decisão a partir de Memory, Discovery, Knowledge, Projects e Business."
        />
      ) : (
        <ul className="space-y-2" data-testid="decision-card-list">
          {visible.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3"
              data-testid="decision-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/decisions/${c.id}`}
                    className="text-[13px] text-zinc-100 hover:text-cyan-300"
                  >
                    {c.title}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                    {c.summary}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-zinc-600">
                    <span>{DECISION_KIND_LABELS[c.kind]}</span>
                    <span>·</span>
                    <span>{DECISION_STATUS_LABELS[c.status]}</span>
                    <span>·</span>
                    <span>conf {c.confidence}</span>
                    <span>·</span>
                    <span>impacto {c.impact}</span>
                    <span>·</span>
                    <span>urgência {c.urgency}</span>
                    <span>·</span>
                    <span className="text-emerald-600/80">exec: none</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[11px]">
                  {(
                    [
                      ["accept", "Aceitar"],
                      ["ignore", "Ignorar"],
                      ["archive", "Arquivar"],
                      ["request_review", "Revisar"],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      className="text-left text-zinc-500 hover:text-cyan-300"
                      onClick={() => {
                        start(async () => {
                          const res = await submitDecisionFeedbackAction({
                            decisionId: c.id,
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
