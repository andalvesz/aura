"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  generateRecommendationsAction,
  searchRecommendationsAction,
  submitRecommendationFeedbackAction,
} from "@/app/actions/recommendation";
import {
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_TYPE_LABELS,
  type ImpactLevel,
  type RecommendationCard,
  type RecommendationStatus,
  type RecommendationType,
  type UrgencyLevel,
} from "@/lib/recommendation/types/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { EmptyState } from "@/components/dashboard/empty-state";

export function RecommendationCenterClient({
  initial,
}: {
  initial: RecommendationCard[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<RecommendationType | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | "all">(
    "all"
  );
  const [impactFilter, setImpactFilter] = useState<ImpactLevel | "all">("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | "all">(
    "all"
  );
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const visible = useMemo(() => {
    return items.filter((c) => {
      if (typeFilter !== "all" && c.recommendationType !== typeFilter)
        return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (impactFilter !== "all" && c.impact !== impactFilter) return false;
      if (urgencyFilter !== "all" && c.urgency !== urgencyFilter) return false;
      return true;
    });
  }, [items, typeFilter, statusFilter, impactFilter, urgencyFilter]);

  const pageItems = visible.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));

  return (
    <div className="space-y-4" data-testid="recommendation-center">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950"
          onClick={() => {
            start(async () => {
              const res = await generateRecommendationsAction();
              if (res.error) toast.error(res.error);
              else {
                toast.success(
                  `${res.items.length} recomendações · validator rejeitou ${res.rejectedCount}`
                );
                router.refresh();
              }
            });
          }}
        >
          Gerar recomendações
        </button>
        <p className="self-center text-[11px] text-zinc-600">
          executionInfluence: none · o que faz sentido, nunca &quot;estou
          fazendo por você&quot;
        </p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (query.trim().length < 2) {
              setItems(initial);
              return;
            }
            const hits = await searchRecommendationsAction(query.trim());
            setItems(hits);
            setPage(0);
          });
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar recomendações, evidências, razões…"
          className={FORM_INPUT_CLASS}
          data-testid="recommendation-search"
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
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as RecommendationType | "all")
          }
          className={FORM_INPUT_CLASS}
          data-testid="recommendation-filter-type"
        >
          <option value="all">Todos os tipos</option>
          {(
            Object.keys(RECOMMENDATION_TYPE_LABELS) as RecommendationType[]
          ).map((k) => (
            <option key={k} value={k}>
              {RECOMMENDATION_TYPE_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as RecommendationStatus | "all")
          }
          className={FORM_INPUT_CLASS}
        >
          <option value="all">Todos os status</option>
          {(
            Object.keys(RECOMMENDATION_STATUS_LABELS) as RecommendationStatus[]
          ).map((s) => (
            <option key={s} value={s}>
              {RECOMMENDATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={impactFilter}
          onChange={(e) =>
            setImpactFilter(e.target.value as ImpactLevel | "all")
          }
          className={FORM_INPUT_CLASS}
        >
          <option value="all">Impacto</option>
          <option value="HIGH">Alto</option>
          <option value="MEDIUM">Médio</option>
          <option value="LOW">Baixo</option>
        </select>
        <select
          value={urgencyFilter}
          onChange={(e) =>
            setUrgencyFilter(e.target.value as UrgencyLevel | "all")
          }
          className={FORM_INPUT_CLASS}
        >
          <option value="all">Urgência</option>
          <option value="HIGH">Alta</option>
          <option value="MEDIUM">Média</option>
          <option value="LOW">Baixa</option>
        </select>
      </div>

      {!visible.length ? (
        <EmptyState
          title="Nenhuma recomendação"
          description="Gere recomendações a partir de Discovery, Decision, Scenario, Prioritization, Projects e Knowledge."
        />
      ) : (
        <>
          <ul className="space-y-2" data-testid="recommendation-item-list">
            {pageItems.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3"
                data-testid="recommendation-item"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/recommendations/${c.id}`}
                      className="text-[13px] text-zinc-100 hover:text-cyan-300"
                    >
                      {c.ranking != null ? `#${c.ranking} ` : ""}
                      {c.title}
                    </Link>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                      {c.summary}
                    </p>
                    {c.conflicts.length ? (
                      <p
                        className="mt-1 text-[10px] text-amber-400/90"
                        data-testid="recommendation-conflict"
                      >
                        Conflito: {c.conflicts[0].conflictSummary}
                      </p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-zinc-600">
                      <span>
                        {RECOMMENDATION_TYPE_LABELS[c.recommendationType]}
                      </span>
                      <span>·</span>
                      <span>{RECOMMENDATION_STATUS_LABELS[c.status]}</span>
                      <span>·</span>
                      <span>score {c.priorityScore}</span>
                      <span>·</span>
                      <span>conf {c.confidence}</span>
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
                            const res =
                              await submitRecommendationFeedbackAction({
                                recommendationId: c.id,
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
          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <button
                type="button"
                disabled={page === 0}
                className="disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                className="disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Próxima
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
