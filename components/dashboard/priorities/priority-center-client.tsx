"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  comparePrioritiesAction,
  generatePrioritiesAction,
  searchPrioritiesAction,
  submitPriorityFeedbackAction,
} from "@/app/actions/prioritization";
import {
  PRIORITY_KIND_LABELS,
  PRIORITY_STATUS_LABELS,
  type ImpactLevel,
  type PriorityItem,
  type PriorityKind,
  type PriorityStatus,
  type UrgencyLevel,
} from "@/lib/prioritization/types/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { EmptyState } from "@/components/dashboard/empty-state";

export function PriorityCenterClient({
  initial,
}: {
  initial: PriorityItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<PriorityKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PriorityStatus | "all">(
    "all"
  );
  const [impactFilter, setImpactFilter] = useState<ImpactLevel | "all">("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | "all">(
    "all"
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<{
    title: string;
    scoreDiffs: Array<{
      priorityId: string;
      title: string;
      priorityScore: number;
      deltaFromLeader: number;
    }>;
  } | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const visible = useMemo(() => {
    return items.filter((c) => {
      if (kindFilter !== "all" && c.kind !== kindFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (impactFilter !== "all" && c.impact !== impactFilter) return false;
      if (urgencyFilter !== "all" && c.urgency !== urgencyFilter) return false;
      return true;
    });
  }, [items, kindFilter, statusFilter, impactFilter, urgencyFilter]);

  const pageItems = visible.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 5)
    );
  }

  return (
    <div className="space-y-4" data-testid="priority-center">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950"
          onClick={() => {
            start(async () => {
              const res = await generatePrioritiesAction();
              if (res.error) toast.error(res.error);
              else {
                toast.success(
                  `${res.items.length} prioridades · validator rejeitou ${res.rejectedCount}`
                );
                router.refresh();
              }
            });
          }}
        >
          Gerar prioridades
        </button>
        <button
          type="button"
          disabled={pending || selected.length < 2}
          className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300 disabled:opacity-40"
          onClick={() => {
            start(async () => {
              const res = await comparePrioritiesAction({
                priorityIds: selected,
              });
              if (res.error) toast.error(res.error);
              else if (res.comparison) {
                setCompareResult(res.comparison);
                toast.success("Comparação pronta");
              }
            });
          }}
        >
          Comparar ({selected.length})
        </button>
        <p className="self-center text-[11px] text-zinc-600">
          executionInfluence: none · o que merece atenção, nunca &quot;faça isto&quot;
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
            const hits = await searchPrioritiesAction(query.trim());
            setItems(hits);
            setPage(0);
          });
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar prioridades, evidências, critérios…"
          className={FORM_INPUT_CLASS}
          data-testid="priority-search"
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
            setKindFilter(e.target.value as PriorityKind | "all")
          }
          className={FORM_INPUT_CLASS}
          data-testid="priority-filter-kind"
        >
          <option value="all">Todos os tipos</option>
          {(Object.keys(PRIORITY_KIND_LABELS) as PriorityKind[]).map((k) => (
            <option key={k} value={k}>
              {PRIORITY_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PriorityStatus | "all")
          }
          className={FORM_INPUT_CLASS}
        >
          <option value="all">Todos os status</option>
          {(Object.keys(PRIORITY_STATUS_LABELS) as PriorityStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {PRIORITY_STATUS_LABELS[s]}
              </option>
            )
          )}
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

      {compareResult ? (
        <section
          className="rounded-lg border border-sky-500/20 bg-sky-950/20 p-3"
          data-testid="priority-comparison"
        >
          <h2 className="text-[12px] font-medium text-sky-200">
            {compareResult.title}
          </h2>
          <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
            {compareResult.scoreDiffs.map((d) => (
              <li key={d.priorityId}>
                {d.title} · score {d.priorityScore} · Δ {d.deltaFromLeader}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!visible.length ? (
        <EmptyState
          title="Nenhuma prioridade"
          description="Gere a fila a partir de Discovery, Decision Support, Scenarios, Projects e Knowledge."
        />
      ) : (
        <>
          <ul className="space-y-2" data-testid="priority-item-list">
            {pageItems.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3"
                data-testid="priority-item"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        aria-label="Selecionar para comparar"
                      />
                      <Link
                        href={`/dashboard/priorities/${c.id}`}
                        className="text-[13px] text-zinc-100 hover:text-cyan-300"
                      >
                        {c.ranking != null ? `#${c.ranking} ` : ""}
                        {c.title}
                      </Link>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                      {c.summary}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-zinc-600">
                      <span>{PRIORITY_KIND_LABELS[c.kind]}</span>
                      <span>·</span>
                      <span>{PRIORITY_STATUS_LABELS[c.status]}</span>
                      <span>·</span>
                      <span>score {c.priorityScore}</span>
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
                        ["confirm", "Confirmar"],
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
                            const res = await submitPriorityFeedbackAction({
                              priorityId: c.id,
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
