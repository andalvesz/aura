"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  answerAgentInputAction,
  cancelAgentSessionAction,
  confirmAgentStepAction,
  pauseAgentSessionAction,
  runAgentSessionAction,
} from "@/app/actions/agent-runtime";
import {
  AGENT_STATUS_LABELS,
  type AgentAuditEntry,
  type AgentExplanation,
  type AgentSession,
  type AgentStep,
} from "@/lib/agent-runtime/types";

export function AgentSessionViewClient({
  session,
  steps,
  audits,
  explanation,
}: {
  session: AgentSession;
  steps: AgentStep[];
  audits: AgentAuditEntry[];
  explanation: AgentExplanation | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showExplain, setShowExplain] = useState(false);
  const [answer, setAnswer] = useState("");

  function run(fn: () => Promise<{ error: string | null }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(ok);
        router.refresh();
      }
    });
  }

  const waitingStep = steps.find(
    (s) =>
      s.status === "WAITING_CONFIRMATION" || s.status === "WAITING_INPUT"
  );

  return (
    <div className="space-y-4" data-testid="agent-session-view">
      <div>
        <Link
          href="/dashboard/agents"
          className="text-[11px] text-zinc-500 hover:text-cyan-300"
        >
          ← Agent Center
        </Link>
        <h1 className="mt-1 text-lg font-medium text-zinc-100">
          {session.objective}
        </h1>
        <p className="text-[12px] text-zinc-500">
          {AGENT_STATUS_LABELS[session.status]} · {session.agentId} ·{" "}
          {session.autonomyLevel} · risco ≤ {session.riskCeiling}
        </p>
      </div>

      {session.planId ? (
        <p className="text-[12px] text-zinc-400">
          Plano:{" "}
          <Link
            href={`/dashboard/plans/${session.planId}`}
            className="text-teal-400 hover:underline"
          >
            {session.planId}
          </Link>
        </p>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Progresso</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          steps {session.stepsUsed}/{session.stepBudget} · actions{" "}
          {session.actionsUsed}/{session.actionBudget}
        </p>
        {session.report ? (
          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-zinc-500">
            {session.report}
          </pre>
        ) : null}
        {session.error ? (
          <p className="mt-2 text-[12px] text-rose-300">{session.error}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Passos</h2>
        <ul className="mt-2 space-y-2 text-[12px]" data-testid="agent-steps">
          {steps.map((s) => (
            <li key={s.id} className="rounded border border-white/[0.04] p-2">
              <p className="text-zinc-200">
                #{s.index + 1} {s.title}
              </p>
              <p className="text-[11px] text-zinc-500">
                {s.status} · {s.actionId ?? "—"}
              </p>
              {s.preparedOutput ? (
                <pre className="mt-1 overflow-auto text-[10px] text-zinc-600">
                  {JSON.stringify(s.preparedOutput, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {waitingStep?.status === "WAITING_CONFIRMATION" ? (
        <section
          className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3"
          data-testid="agent-confirmation"
        >
          <h2 className="text-[12px] font-medium text-amber-200">
            Confirmação necessária
          </h2>
          <p className="mt-1 text-[12px] text-amber-100/80">
            {waitingStep.title}
          </p>
          <p className="text-[11px] text-amber-200/60">
            Ação: {waitingStep.actionId} · expira{" "}
            {waitingStep.confirmationExpiresAt}
          </p>
          <button
            type="button"
            disabled={pending || !waitingStep.confirmationToken}
            className="mt-2 rounded border border-amber-500/40 px-3 py-1.5 text-[12px] text-amber-100"
            onClick={() =>
              run(
                () =>
                  confirmAgentStepAction(
                    session.id,
                    waitingStep.confirmationToken!
                  ),
                "Confirmado e executado"
              )
            }
          >
            Confirmar
          </button>
        </section>
      ) : null}

      {waitingStep?.status === "WAITING_INPUT" ? (
        <section
          className="rounded-lg border border-sky-500/30 bg-sky-950/20 p-3"
          data-testid="agent-input"
        >
          <h2 className="text-[12px] font-medium text-sky-200">
            Informação necessária
          </h2>
          <p className="mt-1 text-[12px] text-sky-100/80">
            {waitingStep.question}
          </p>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="mt-2 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-200"
            placeholder="Sua resposta"
          />
          <button
            type="button"
            disabled={pending || !answer.trim()}
            className="mt-2 rounded border border-sky-500/40 px-3 py-1.5 text-[12px] text-sky-100"
            onClick={() =>
              run(
                () => answerAgentInputAction(session.id, answer),
                "Resposta enviada"
              )
            }
          >
            Responder
          </button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2" data-testid="agent-session-actions">
        {["READY", "PAUSED", "PARTIAL"].includes(session.status) ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(() => runAgentSessionAction(session.id), "Execução avançada")
            }
          >
            {session.status === "PAUSED" ? "Retomar" : "Iniciar"}
          </Btn>
        ) : null}
        {!["COMPLETED", "CANCELLED", "RUNNING"].includes(session.status) ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(() => pauseAgentSessionAction(session.id), "Pausada")
            }
          >
            Pausar
          </Btn>
        ) : null}
        {!["COMPLETED", "CANCELLED"].includes(session.status) ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(() => cancelAgentSessionAction(session.id), "Cancelada")
            }
          >
            Cancelar
          </Btn>
        ) : null}
        {session.planId ? (
          <Link
            href={`/dashboard/plans/${session.planId}`}
            className="rounded border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
          >
            Abrir plano
          </Link>
        ) : null}
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <button
          type="button"
          className="text-[12px] text-cyan-400 hover:underline"
          onClick={() => setShowExplain((v) => !v)}
        >
          Por que o agente quer fazer isso?
        </button>
        {showExplain && explanation ? (
          <div className="mt-2 space-y-1 text-[12px] text-zinc-400">
            <p>{explanation.why}</p>
            <p>Ação: {explanation.currentAction ?? "—"}</p>
            <p>
              Orçamento: {explanation.budgets.steps} steps ·{" "}
              {explanation.budgets.actions} actions
            </p>
            <p>Vai alterar: {explanation.willChange.join("; ")}</p>
            <p>Não vai: {explanation.willNotChange.join("; ")}</p>
          </div>
        ) : null}
      </section>

      {session.checkpoint ? (
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">Checkpoint</h2>
          <pre className="mt-2 overflow-auto text-[10px] text-zinc-600">
            {JSON.stringify(session.checkpoint, null, 2)}
          </pre>
        </section>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Auditoria</h2>
        <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
          {audits.map((a) => (
            <li key={a.id}>
              {a.createdAt.slice(11, 19)} · {a.action} · {a.summary}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-white/10 px-3 py-1.5 text-[12px] text-zinc-200 hover:border-cyan-500/40 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
