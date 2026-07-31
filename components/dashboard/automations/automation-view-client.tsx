"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelAutomationAction,
  confirmAutomationAction,
  executeAutomationAction,
  prepareAutomationAction,
  retryAutomationAction,
  scheduleAutomationAction,
  undoAutomationAction,
} from "@/app/actions/automation";
import {
  AUTOMATION_STATUS_LABELS,
  type Automation,
  type AutomationAuditEntry,
  type AutomationExplanation,
} from "@/lib/automation/types/types";

export function AutomationViewClient({
  automation,
  explanation,
  audits,
}: {
  automation: Automation;
  explanation: AutomationExplanation | null;
  audits: AutomationAuditEntry[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showExplain, setShowExplain] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");

  function run(
    fn: () => Promise<{ error: string | null }>,
    okMsg: string
  ) {
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  const a = automation;
  const canPrepare = ["PROPOSED", "DRAFT", "BLOCKED", "FAILED"].includes(
    a.status
  );
  const canConfirm =
    a.status === "AWAITING_CONFIRMATION" && Boolean(a.confirmationToken);
  const canExecute = ["APPROVED", "PREPARED", "SCHEDULED"].includes(a.status);
  const canCancel = ![
    "SUCCEEDED",
    "UNDONE",
    "RUNNING",
    "CANCELLED",
  ].includes(a.status);
  const canRetry = a.status === "FAILED" || a.status === "BLOCKED";
  const canUndo =
    a.status === "SUCCEEDED" &&
    a.reversibility !== "none" &&
    Boolean(a.undoToken || a.executionResult);

  return (
    <div className="space-y-4" data-testid="automation-view">
      <div>
        <Link
          href="/dashboard/automations"
          className="text-[11px] text-zinc-500 hover:text-cyan-300"
        >
          ← Automation Center
        </Link>
        <h1 className="mt-1 text-lg font-medium text-zinc-100">{a.title}</h1>
        <p className="text-[12px] text-zinc-500">
          {AUTOMATION_STATUS_LABELS[a.status]} · {a.actionId} · {a.riskLevel} ·{" "}
          {a.autonomyLevel} · {a.executionInfluence}
        </p>
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Origem</h2>
        <p className="mt-1 text-[12px] text-zinc-400">
          {a.sourceType}
          {a.sourceId ? ` · ${a.sourceId}` : ""}
        </p>
        {a.planId ? (
          <p className="mt-1 text-[12px] text-zinc-400">
            Plano:{" "}
            <Link
              href={`/dashboard/plans/${a.planId}`}
              className="text-cyan-400 hover:underline"
            >
              {a.planId}
            </Link>
            {a.planStepId ? ` · etapa ${a.planStepId}` : ""}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Ação</h2>
        <p className="mt-1 text-[12px] text-zinc-400">
          {a.actionId} v{a.actionVersion} · reversibilidade {a.reversibility}
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">{a.description}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Payload sanitizado
        </h2>
        <pre className="mt-2 overflow-auto text-[11px] text-zinc-500">
          {JSON.stringify(a.preparedOutput?.preview ?? a.input, null, 2)}
        </pre>
      </section>

      {a.preparedOutput ? (
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">Preparação</h2>
          <pre className="mt-2 overflow-auto text-[11px] text-zinc-500">
            {JSON.stringify(a.preparedOutput, null, 2)}
          </pre>
        </section>
      ) : null}

      {a.confirmedAt ? (
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">Confirmação</h2>
          <p className="mt-1 text-[12px] text-zinc-400">
            Por {a.confirmedBy} em {a.confirmedAt}
          </p>
        </section>
      ) : null}

      {a.executionResult ? (
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">Resultado</h2>
          <pre className="mt-2 overflow-auto text-[11px] text-zinc-500">
            {JSON.stringify(a.executionResult, null, 2)}
          </pre>
        </section>
      ) : null}

      {a.executionError || a.gateFailures.length ? (
        <section className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3">
          <h2 className="text-[12px] font-medium text-rose-200">Erros / gates</h2>
          <p className="mt-1 text-[12px] text-rose-100/80">
            {a.executionError}
          </p>
          {a.gateFailures.length ? (
            <ul className="mt-1 text-[11px] text-rose-200/70">
              {a.gateFailures.map((g) => (
                <li key={g}>· {g}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Limites / concorrência
        </h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          cooldown: {a.cooldownKey} · tentativas {a.executionAttempt}/
          {a.maxAttempts} · row_version {a.rowVersion}
          {a.leaseOwner ? ` · lease ${a.leaseOwner}` : ""}
          {a.scheduledFor ? ` · agendada ${a.scheduledFor}` : ""}
        </p>
      </section>

      <div className="flex flex-wrap gap-2" data-testid="automation-actions">
        {canPrepare ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(() => prepareAutomationAction(a.id), "Preparada")
            }
          >
            Preparar
          </Btn>
        ) : null}
        {canConfirm ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  confirmAutomationAction(a.id, a.confirmationToken!),
                "Confirmada"
              )
            }
          >
            Confirmar
          </Btn>
        ) : null}
        {canExecute ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(
                () => executeAutomationAction(a.id, true),
                "Executada"
              )
            }
          >
            Executar
          </Btn>
        ) : null}
        {canRetry ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(() => retryAutomationAction(a.id), "Retry enviado")
            }
          >
            Tentar novamente
          </Btn>
        ) : null}
        {canUndo ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(() => undoAutomationAction(a.id), "Desfeita")
            }
          >
            Desfazer
          </Btn>
        ) : null}
        {canCancel ? (
          <Btn
            disabled={pending}
            onClick={() =>
              run(() => cancelAutomationAction(a.id), "Cancelada")
            }
          >
            Cancelar
          </Btn>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-zinc-500">
          Agendar
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="mt-1 block rounded border border-white/10 bg-zinc-900 px-2 py-1 text-zinc-300"
          />
        </label>
        <Btn
          disabled={pending || !scheduleAt}
          onClick={() => {
            const iso = new Date(scheduleAt).toISOString();
            run(
              () => scheduleAutomationAction(a.id, iso),
              "Agendada"
            );
          }}
        >
          Agendar
        </Btn>
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <button
          type="button"
          className="text-[12px] font-medium text-cyan-400 hover:underline"
          onClick={() => setShowExplain((v) => !v)}
          data-testid="automation-explain-toggle"
        >
          Por que o Aura quer fazer isso?
        </button>
        {showExplain && explanation ? (
          <div className="mt-2 space-y-2 text-[12px] text-zinc-400" data-testid="automation-explain">
            <p>{explanation.why}</p>
            <p>Ação: {explanation.actionId}</p>
            <p>Risco: {explanation.riskLevel} · Autonomia: {explanation.autonomyLevel}</p>
            <p>Evidências: {explanation.evidence.join(" · ") || "—"}</p>
            <p>Vai alterar: {explanation.willChange.join("; ")}</p>
            <p>Não vai alterar: {explanation.willNotChange.join("; ")}</p>
            <p>Limitações: {explanation.limitations.join("; ")}</p>
            {explanation.gateFailures.length ? (
              <p className="text-rose-300">
                Gates falhos: {explanation.gateFailures.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Auditoria</h2>
        <ul className="mt-2 space-y-1 text-[11px] text-zinc-500" data-testid="automation-audit">
          {audits.map((e) => (
            <li key={e.id}>
              {e.createdAt.slice(11, 19)} · {e.action} · {e.summary}
            </li>
          ))}
          {!audits.length ? <li>Sem eventos</li> : null}
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
