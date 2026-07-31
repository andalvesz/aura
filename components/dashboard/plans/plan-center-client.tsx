"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  generatePlanAction,
  searchPlansAction,
} from "@/app/actions/planner";
import {
  PLAN_STATUS_LABELS,
  type Plan,
  type PlanStatus,
} from "@/lib/planner/types/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { EmptyState } from "@/components/dashboard/empty-state";

type ViewMode = "lista" | "kanban" | "timeline" | "projeto" | "missao" | "responsavel";

const BOARD_COLUMNS: PlanStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "IN_PROGRESS",
  "PAUSED",
  "BLOCKED",
  "COMPLETED",
  "ARCHIVED",
];

export function PlanCenterClient({ initial }: { initial: Plan[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "all">("all");
  const [view, setView] = useState<ViewMode>("lista");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const visible = useMemo(() => {
    return items.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [items, statusFilter]);

  const pageItems = visible.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));

  function PlanCard({ p }: { p: Plan }) {
    return (
      <li
        className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3"
        data-testid="plan-item"
      >
        <Link
          href={`/dashboard/plans/${p.id}`}
          className="text-[13px] text-zinc-100 hover:text-cyan-300"
        >
          {p.title}
        </Link>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
          {p.summary}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-zinc-600">
          <span>{PLAN_STATUS_LABELS[p.status]}</span>
          <span>·</span>
          <span>{p.sourceKind}</span>
          <span>·</span>
          <span>{p.steps.length} etapas</span>
          <span>·</span>
          <span className="text-emerald-600/80">exec: none</span>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4" data-testid="plan-center">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950"
          onClick={() => {
            start(async () => {
              const res = await generatePlanAction({
                sourceKind: "recommendation",
              });
              if (res.error) toast.error(res.error);
              else {
                toast.success("Plano DRAFT gerado — revisão humana necessária");
                router.refresh();
              }
            });
          }}
        >
          Gerar de recomendação
        </button>
        <button
          type="button"
          disabled={pending}
          className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
          onClick={() => {
            start(async () => {
              const res = await generatePlanAction({
                sourceKind: "manual",
                title: "Plano manual",
                objective: "Definir objetivo com revisão humana",
              });
              if (res.error) toast.error(res.error);
              else {
                toast.success("Plano manual criado");
                router.refresh();
              }
            });
          }}
        >
          Criar manual
        </button>
        <p className="self-center text-[11px] text-zinc-600">
          executionInfluence: none · nunca executa · nunca cria tarefas sozinho
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {(
          [
            ["lista", "Lista"],
            ["kanban", "Kanban"],
            ["timeline", "Timeline"],
            ["projeto", "Por projeto"],
            ["missao", "Por missão"],
            ["responsavel", "Por responsável"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`min-h-9 rounded border px-2 ${
              view === id
                ? "border-cyan-500/40 text-cyan-200"
                : "border-white/10 text-zinc-500"
            }`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
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
            const hits = await searchPlansAction(query.trim());
            setItems(hits);
            setPage(0);
          });
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar planos, etapas, marcos…"
          className={FORM_INPUT_CLASS}
          data-testid="plan-search"
        />
        <button
          type="submit"
          className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
        >
          Buscar
        </button>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PlanStatus | "all")
          }
          className={FORM_INPUT_CLASS}
        >
          <option value="all">Todos os status</option>
          {BOARD_COLUMNS.map((s) => (
            <option key={s} value={s}>
              {PLAN_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </form>

      {!visible.length ? (
        <EmptyState
          title="Nenhum plano"
          description="Gere a partir de uma recomendação aceita ou crie manualmente."
        />
      ) : view === "kanban" ? (
        <div
          className="grid gap-2 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4"
          data-testid="plan-kanban"
        >
          {BOARD_COLUMNS.map((col) => (
            <div key={col} className="min-w-[160px] space-y-2">
              <h3 className="text-[11px] font-medium text-zinc-400">
                {PLAN_STATUS_LABELS[col]}
              </h3>
              <ul className="space-y-2">
                {visible
                  .filter((p) => p.status === col)
                  .map((p) => (
                    <PlanCard key={p.id} p={p} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      ) : view === "timeline" ? (
        <ul className="space-y-2" data-testid="plan-timeline">
          {[...visible]
            .sort((a, b) =>
              (a.startDateSuggested ?? "").localeCompare(
                b.startDateSuggested ?? ""
              )
            )
            .map((p) => (
              <li key={p.id} className="flex gap-3 text-[12px]">
                <span className="w-24 shrink-0 text-zinc-600">
                  {p.startDateSuggested ?? "—"}
                </span>
                <Link
                  href={`/dashboard/plans/${p.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {p.title}
                </Link>
                <span className="text-zinc-600">
                  → {p.targetDateSuggested ?? "?"}
                </span>
              </li>
            ))}
        </ul>
      ) : view === "projeto" || view === "missao" || view === "responsavel" ? (
        <div className="space-y-3">
          {Object.entries(
            visible.reduce<Record<string, Plan[]>>((acc, p) => {
              const key =
                view === "projeto"
                  ? p.projectId ?? "sem-projeto"
                  : view === "missao"
                    ? p.missionId ?? "sem-missao"
                    : p.ownerId || "sem-responsavel";
              (acc[key] ??= []).push(p);
              return acc;
            }, {})
          ).map(([group, plans]) => (
            <div key={group}>
              <h3 className="mb-1 text-[11px] text-zinc-500">{group}</h3>
              <ul className="space-y-2">
                {plans.map((p) => (
                  <PlanCard key={p.id} p={p} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul className="space-y-2" data-testid="plan-item-list">
            {pageItems.map((p) => (
              <PlanCard key={p.id} p={p} />
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
