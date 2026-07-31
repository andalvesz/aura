"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  AUTOMATION_STATUS_LABELS,
  type Automation,
  type AutomationStatus,
} from "@/lib/automation/types/types";

const SECTIONS: { key: string; statuses: AutomationStatus[]; label: string }[] =
  [
    { key: "suggested", statuses: ["PROPOSED", "DRAFT"], label: "Sugeridas" },
    { key: "prepared", statuses: ["PREPARED"], label: "Preparadas" },
    {
      key: "awaiting",
      statuses: ["AWAITING_CONFIRMATION"],
      label: "Aguardando confirmação",
    },
    { key: "scheduled", statuses: ["SCHEDULED", "APPROVED"], label: "Agendadas" },
    { key: "running", statuses: ["RUNNING"], label: "Em execução" },
    { key: "done", statuses: ["SUCCEEDED"], label: "Concluídas" },
    { key: "failed", statuses: ["FAILED"], label: "Falhas" },
    { key: "blocked", statuses: ["BLOCKED"], label: "Bloqueadas" },
    { key: "cancelled", statuses: ["CANCELLED", "EXPIRED"], label: "Canceladas" },
    { key: "undone", statuses: ["UNDONE"], label: "Desfeitas" },
  ];

export function AutomationCenterClient({ items }: { items: Automation[] }) {
  const [status, setStatus] = useState<string>("all");
  const [actionId, setActionId] = useState("");
  const [risk, setRisk] = useState("all");
  const [q, setQ] = useState("");
  const [, start] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (actionId && a.actionId !== actionId) return false;
      if (risk !== "all" && a.riskLevel !== risk) return false;
      if (q) {
        const qq = q.toLowerCase();
        if (
          !a.title.toLowerCase().includes(qq) &&
          !a.actionId.toLowerCase().includes(qq) &&
          !(a.planId ?? "").includes(qq)
        )
          return false;
      }
      return true;
    });
  }, [items, status, actionId, risk, q]);

  const actions = useMemo(
    () => [...new Set(items.map((a) => a.actionId))].sort(),
    [items]
  );

  return (
    <div className="space-y-6" data-testid="automation-center">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Aura Brain
        </p>
        <h1 className="text-lg font-medium text-zinc-100">Automation Center</h1>
        <p className="text-[12px] text-zinc-500">
          Automações controladas · sem agentes autônomos · sem ações externas
        </p>
      </header>

      <div
        className="flex flex-wrap gap-2 text-[11px]"
        data-testid="automation-filters"
      >
        <select
          value={status}
          onChange={(e) => start(() => setStatus(e.target.value))}
          className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-300"
        >
          <option value="all">Status</option>
          {Object.keys(AUTOMATION_STATUS_LABELS).map((s) => (
            <option key={s} value={s}>
              {AUTOMATION_STATUS_LABELS[s as AutomationStatus]}
            </option>
          ))}
        </select>
        <select
          value={actionId}
          onChange={(e) => setActionId(e.target.value)}
          className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-300"
        >
          <option value="">Ação</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
          className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-300"
        >
          <option value="all">Risco</option>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar / plano / ação"
          className="min-w-[160px] flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-300"
        />
      </div>

      {SECTIONS.map((sec) => {
        const rows = filtered.filter((a) => sec.statuses.includes(a.status));
        if (!rows.length && status === "all" && !q && !actionId && risk === "all")
          return null;
        if (!rows.length) return null;
        return (
          <section key={sec.key} data-testid={`automation-section-${sec.key}`}>
            <h2 className="mb-2 text-[12px] font-medium text-zinc-300">
              {sec.label} ({rows.length})
            </h2>
            <ul className="space-y-1">
              {rows.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/automations/${a.id}`}
                    className="block rounded-lg border border-white/[0.06] px-3 py-2 hover:border-cyan-500/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] text-zinc-200">{a.title}</p>
                        <p className="text-[11px] text-zinc-500">
                          {AUTOMATION_STATUS_LABELS[a.status]} · {a.actionId} ·{" "}
                          {a.riskLevel} · {a.autonomyLevel}
                          {a.planId ? ` · plano ${a.planId.slice(0, 8)}` : ""}
                        </p>
                      </div>
                      <span className="text-[10px] text-zinc-600">
                        {a.executionInfluence}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {!filtered.length ? (
        <p className="text-[13px] text-zinc-500" data-testid="automation-empty">
          Nenhuma automação. Prepare a partir de uma etapa aprovada de plano.
        </p>
      ) : null}
    </div>
  );
}
