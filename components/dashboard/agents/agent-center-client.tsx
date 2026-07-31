"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAgentSessionAction,
  enableAgentAction,
  runAgentSessionAction,
} from "@/app/actions/agent-runtime";
import {
  AGENT_STATUS_LABELS,
  type AgentDefinition,
  type AgentId,
  type AgentSession,
  type AgentSessionStatus,
} from "@/lib/agent-runtime/types";

const SECTIONS: {
  key: string;
  statuses: AgentSessionStatus[];
  label: string;
}[] = [
  {
    key: "active",
    statuses: ["READY", "RUNNING"],
    label: "Sessões em andamento",
  },
  {
    key: "confirm",
    statuses: ["WAITING_CONFIRMATION"],
    label: "Aguardando confirmação",
  },
  {
    key: "input",
    statuses: ["WAITING_INPUT"],
    label: "Aguardando informação",
  },
  { key: "done", statuses: ["COMPLETED"], label: "Concluídas" },
  { key: "partial", statuses: ["PARTIAL"], label: "Parciais" },
  { key: "failed", statuses: ["FAILED", "BLOCKED"], label: "Falhas" },
  { key: "paused", statuses: ["PAUSED"], label: "Pausadas" },
  {
    key: "cancelled",
    statuses: ["CANCELLED", "EXPIRED"],
    label: "Canceladas",
  },
];

type AgentRow = AgentDefinition & {
  enabled: boolean;
};

export function AgentCenterClient({
  agents,
  sessions,
}: {
  agents: AgentRow[];
  sessions: AgentSession[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    if (status === "all") return sessions;
    return sessions.filter((s) => s.status === status);
  }, [sessions, status]);

  return (
    <div className="space-y-6" data-testid="agent-center">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Aura Brain
        </p>
        <h1 className="text-lg font-medium text-zinc-100">Agent Center</h1>
        <p className="text-[12px] text-zinc-500">
          Agentes controlados · Action Registry · sem autonomia irrestrita
        </p>
      </header>

      <section data-testid="agents-available">
        <h2 className="mb-2 text-[12px] font-medium text-zinc-300">
          Disponíveis
        </h2>
        <ul className="space-y-2">
          {agents.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-white/[0.06] px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] text-zinc-200">{a.name}</p>
                  <p className="text-[11px] text-zinc-500">{a.description}</p>
                  <p className="text-[10px] text-zinc-600">
                    risco ≤ {a.maximumRiskLevel} · steps {a.maximumSteps} ·{" "}
                    {a.enabled ? "habilitado" : "desativado"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!a.enabled ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[11px] text-cyan-400 hover:underline"
                      onClick={() =>
                        start(async () => {
                          const r = await enableAgentAction(a.id, {
                            maxAutonomyLevel: "PREPARE",
                          });
                          if (r.error) toast.error(r.error);
                          else {
                            toast.success("Agente habilitado");
                            router.refresh();
                          }
                        })
                      }
                    >
                      Habilitar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[11px] text-teal-400 hover:underline"
                      onClick={() =>
                        start(async () => {
                          const r = await createAgentSessionAction({
                            agentId: a.id as AgentId,
                            objective: `Sessão ${a.name}`,
                            sourceType: "manual",
                          });
                          if (r.error) toast.error(r.error);
                          else if (r.session) {
                            toast.success("Sessão criada");
                            router.push(`/dashboard/agents/${r.session.id}`);
                          }
                        })
                      }
                    >
                      Nova sessão
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-2 text-[11px]">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-300"
        >
          <option value="all">Status</option>
          {Object.keys(AGENT_STATUS_LABELS).map((s) => (
            <option key={s} value={s}>
              {AGENT_STATUS_LABELS[s as AgentSessionStatus]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          className="text-zinc-500 hover:text-cyan-300"
          onClick={() => router.refresh()}
        >
          Atualizar
        </button>
      </div>

      {SECTIONS.map((sec) => {
        const rows = filtered.filter((s) => sec.statuses.includes(s.status));
        if (!rows.length) return null;
        return (
          <section key={sec.key} data-testid={`agent-section-${sec.key}`}>
            <h2 className="mb-2 text-[12px] font-medium text-zinc-300">
              {sec.label} ({rows.length})
            </h2>
            <ul className="space-y-1">
              {rows.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/dashboard/agents/${s.id}`}
                    className="block rounded-lg border border-white/[0.06] px-3 py-2 hover:border-cyan-500/30"
                  >
                    <p className="text-[13px] text-zinc-200">{s.objective}</p>
                    <p className="text-[11px] text-zinc-500">
                      {AGENT_STATUS_LABELS[s.status]} · {s.agentId} ·{" "}
                      {s.autonomyLevel}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {!filtered.length ? (
        <p className="text-[13px] text-zinc-500">
          Nenhuma sessão. Habilite um agente e inicie a partir de um plano
          aprovado ou manualmente.
        </p>
      ) : null}
    </div>
  );
}
