"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addPlanCommentAction,
  approvePlanAction,
  archivePlanAction,
  completePlanAction,
  completePlanStepAction,
  duplicatePlanAction,
  pausePlanAction,
  rejectPlanAction,
  reorderPlanStepsAction,
  startPlanAction,
  submitPlanFeedbackAction,
  submitPlanForReviewAction,
} from "@/app/actions/planner";
import { proposeFromPlanStepAction } from "@/app/actions/automation";
import {
  createSessionFromPlanAction,
  enableAgentAction,
} from "@/app/actions/agent-runtime";
import type { Automation } from "@/lib/automation/types/types";
import type { AgentId } from "@/lib/agent-runtime/types";
import {
  PLAN_STATUS_LABELS,
  type Plan,
  type PlanComment,
  type PlanExplanation,
} from "@/lib/planner/types/types";

export function PlanViewClient({
  plan,
  explanation,
  comments,
  linkedAutomations = [],
}: {
  plan: Plan;
  explanation: PlanExplanation | null;
  comments: PlanComment[];
  linkedAutomations?: Automation[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showExplain, setShowExplain] = useState(false);
  const [comment, setComment] = useState("");
  const [steps, setSteps] = useState(plan.steps);

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

  return (
    <div className="space-y-4" data-testid="plan-view">
      <div>
        <Link
          href="/dashboard/plans"
          className="text-[11px] text-zinc-500 hover:text-cyan-300"
        >
          ← Plan Center
        </Link>
        <h1 className="mt-1 text-lg font-medium text-zinc-100">{plan.title}</h1>
        <p className="text-[12px] text-zinc-500">
          {PLAN_STATUS_LABELS[plan.status]} · {plan.sourceKind} · conf{" "}
          {plan.confidence} · executionInfluence: none
        </p>
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Resumo</h2>
        <p className="mt-1 text-[13px] text-zinc-400">{plan.summary}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Objetivo</h2>
        <p className="mt-1 text-[13px] text-zinc-400">{plan.objective}</p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Fonte</h2>
        <p className="mt-1 text-[12px] text-zinc-400">
          {plan.sourceKind}
          {plan.sourceId ? ` · ${plan.sourceId}` : ""}
          {plan.recommendationId
            ? ` · recomendação ${plan.recommendationId}`
            : ""}
        </p>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-medium text-zinc-300">Etapas</h2>
          <button
            type="button"
            className="text-[11px] text-zinc-500 hover:text-cyan-300"
            onClick={() => {
              const reversed = [...steps].reverse().map((s, i) => ({
                ...s,
                order: i,
              }));
              setSteps(reversed);
              run(
                () =>
                  reorderPlanStepsAction(
                    plan.id,
                    reversed.map((s) => s.id)
                  ),
                "Etapas reordenadas"
              );
            }}
          >
            Inverter ordem
          </button>
        </div>
        <ul className="mt-2 space-y-2" data-testid="plan-steps">
          {steps
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <li
                key={s.id}
                className="rounded border border-white/[0.04] p-2 text-[12px]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-zinc-200">
                      #{s.order + 1} {s.title}
                    </p>
                    <p className="text-[11px] text-zinc-500">{s.description}</p>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {s.status} · {s.stepType} · depends:{" "}
                      {s.dependsOn.length || "—"} · conf required:{" "}
                      {s.requiresConfirmation ? "yes" : "no"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      disabled={pending || s.status === "COMPLETED"}
                      className="text-[11px] text-zinc-500 hover:text-cyan-300 disabled:opacity-40"
                      onClick={() =>
                        run(
                          () => completePlanStepAction(plan.id, s.id),
                          "Etapa concluída"
                        )
                      }
                    >
                      Concluir
                    </button>
                    {(plan.status === "APPROVED" ||
                      plan.status === "IN_PROGRESS") &&
                    s.status !== "BLOCKED" &&
                    s.status !== "CANCELLED" ? (
                      <button
                        type="button"
                        disabled={pending}
                        data-testid={`prepare-automation-${s.id}`}
                        className="text-[11px] text-teal-400/90 hover:text-teal-300 disabled:opacity-40"
                        onClick={() =>
                          run(async () => {
                            const res = await proposeFromPlanStepAction({
                              planId: plan.id,
                              planStepId: s.id,
                              planStatus: plan.status,
                              planStepStatus: s.status,
                              stepTitle: s.title,
                              stepDescription: s.description,
                              stepType: s.stepType,
                              projectId: plan.projectId,
                            });
                            if (res.automation) {
                              router.push(
                                `/dashboard/automations/${res.automation.id}`
                              );
                            }
                            return res;
                          }, "Proposta de automação criada")
                        }
                      >
                        Preparar automação
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section
        className="rounded-lg border border-white/[0.06] p-3"
        data-testid="plan-automations"
      >
        <h2 className="text-[12px] font-medium text-zinc-300">
          Automações vinculadas
        </h2>
        <p className="mt-1 text-[11px] text-zinc-600">
          Etapas automatizáveis não executam ao abrir o plano. Uma automação
          concluída pode sugerir conclusão — nunca conclui sozinha, salvo ação
          explícita registrada.
        </p>
        {linkedAutomations.length ? (
          <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
            {linkedAutomations.map((au) => (
              <li key={au.id}>
                <Link
                  href={`/dashboard/automations/${au.id}`}
                  className="text-teal-400 hover:underline"
                >
                  {au.title}
                </Link>{" "}
                · {au.status}
                {au.gateFailures.length
                  ? ` · bloqueio: ${au.gateFailures.join(", ")}`
                  : ""}
                {au.status === "SUCCEEDED" ? (
                  <span className="text-zinc-600">
                    {" "}
                    · sugestão: concluir etapa manualmente
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12px] text-zinc-600">
            Nenhuma automação vinculada.
          </p>
        )}
      </section>

      {(plan.status === "APPROVED" || plan.status === "IN_PROGRESS") ? (
        <section
          className="rounded-lg border border-white/[0.06] p-3"
          data-testid="plan-agents"
        >
          <h2 className="text-[12px] font-medium text-zinc-300">
            Executar com Aura Agent
          </h2>
          <p className="mt-1 text-[11px] text-zinc-600">
            Nenhum agente inicia automaticamente ao aprovar o plano. Escolha um
            agente compatível.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["plan_assistant_v1", "Plan Assistant"],
                ["daily_organizer_v1", "Daily Organizer"],
                ["project_review_v1", "Project Review"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={pending}
                data-testid={`run-agent-${id}`}
                className="rounded border border-cyan-500/30 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-950/30 disabled:opacity-40"
                onClick={() =>
                  run(async () => {
                    await enableAgentAction(id as AgentId, {
                      maxAutonomyLevel: "CONFIRM",
                    });
                    const res = await createSessionFromPlanAction({
                      planId: plan.id,
                      planStatus: plan.status,
                      planTitle: plan.title,
                      agentId: id as AgentId,
                      projectId: plan.projectId,
                      planRowVersion: plan.rowVersion,
                      steps: plan.steps.map((s) => ({
                        id: s.id,
                        title: s.title,
                        status: s.status,
                        stepType: s.stepType,
                        description: s.description,
                      })),
                    });
                    if (res.session) {
                      router.push(`/dashboard/agents/${res.session.id}`);
                    }
                    return res;
                  }, "Sessão do agente criada")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {plan.dependencyIssues.length ? (
        <section
          className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3"
          data-testid="plan-dependencies"
        >
          <h2 className="text-[12px] font-medium text-amber-200">
            Dependências / conflitos
          </h2>
          <p className="mt-1 text-[11px] text-amber-200/70">
            Nada é corrigido automaticamente — revisão humana necessária.
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-amber-100/80">
            {plan.dependencyIssues.map((i) => (
              <li key={i.id}>· [{i.kind}] {i.summary}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Milestones</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {plan.milestones.map((m) => (
            <li key={m.id}>
              {m.title} · {m.targetDateSuggested ?? "sem data"} · {m.status}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Riscos</h2>
        <ul className="mt-2 space-y-2 text-[12px] text-zinc-400">
          {plan.risks.map((r) => (
            <li key={r.id}>
              <span className="text-zinc-200">{r.title}</span> · impacto{" "}
              {r.impact} · prob. estimada {r.probability}
              <p className="text-[11px] text-zinc-500">
                Mitigação: {r.mitigationSuggested}
              </p>
              <p className="text-[11px] text-zinc-600">
                Alternativa: {r.alternativePlan}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Recursos</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {plan.resources.map((r) => (
            <li key={r.id}>
              [{r.kind}] {r.title} · {r.availability}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Prazos sugeridos
        </h2>
        <p className="mt-1 text-[12px] text-zinc-400">
          Início: {plan.startDateSuggested ?? "—"} · Alvo:{" "}
          {plan.targetDateSuggested ?? "—"}
        </p>
        <p className="text-[11px] text-zinc-600">
          Nenhuma reserva de calendário é feita.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Relation
          title="Projeto"
          id={plan.projectId}
          href={(id) => `/dashboard/projects/${id}`}
        />
        <Relation
          title="Missão"
          id={plan.missionId}
          href={() => "/dashboard/missions"}
        />
        <Relation
          title="Recomendação"
          id={plan.recommendationId}
          href={(id) => `/dashboard/recommendations/${id}`}
        />
        <Relation
          title="Decision"
          id={plan.decisionId}
          href={(id) => `/dashboard/decisions/${id}`}
        />
      </div>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Limitações</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {plan.limitations.map((l) => (
            <li key={l}>· {l}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Critérios de sucesso
        </h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {plan.successCriteria.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Comentários</h2>
        <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
          {comments.map((c) => (
            <li key={c.id}>
              <span className="text-zinc-500">{c.userId.slice(0, 8)}</span>:{" "}
              {c.body}
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                addPlanCommentAction({ planId: plan.id, body: comment }),
              "Comentário adicionado"
            );
            setComment("");
          }}
        >
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-11 flex-1 rounded border border-white/10 bg-zinc-950 px-2 text-[12px] text-zinc-200"
            placeholder="Comentar…"
          />
          <button
            type="submit"
            className="rounded border border-white/10 px-3 text-[12px] text-zinc-300"
          >
            Enviar
          </button>
        </form>
      </section>

      <div>
        <button
          type="button"
          data-testid="plan-explain-btn"
          className="min-h-11 rounded border border-cyan-500/30 px-3 text-[12px] text-cyan-200"
          onClick={() => setShowExplain((v) => !v)}
        >
          Como o Aura estruturou este plano?
        </button>
        {showExplain && explanation ? (
          <section
            className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-3"
            data-testid="plan-pipeline"
          >
            <h2 className="text-[12px] font-medium text-cyan-200">
              Pipeline / regras
            </h2>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px] text-zinc-400">
              {explanation.pipelineSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-zinc-500">
              Premissas: {explanation.assumptions.join(" · ")}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Decisões humanas: {explanation.humanDecisionPoints.slice(0, 4).join(" · ")}
            </p>
            <p className="mt-2 text-[11px] text-zinc-600">
              executionInfluence: none
            </p>
          </section>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["review", "Solicitar revisão", () => submitPlanForReviewAction(plan.id)],
            ["approve", "Aprovar", () => approvePlanAction(plan.id)],
            ["reject", "Rejeitar", () => rejectPlanAction(plan.id)],
            ["start", "Iniciar", () => startPlanAction(plan.id)],
            ["pause", "Pausar", () => pausePlanAction(plan.id)],
            ["complete", "Concluir plano", () => completePlanAction(plan.id, true)],
            ["dup", "Duplicar", () => duplicatePlanAction(plan.id)],
            ["archive", "Arquivar", () => archivePlanAction(plan.id)],
          ] as const
        ).map(([key, label, fn]) => (
          <button
            key={key}
            type="button"
            disabled={pending}
            className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
            onClick={() => run(fn, label)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {(
          [
            "useful",
            "not_useful",
            "too_complex",
            "missing_step",
            "wrong_order",
            "needs_review",
          ] as const
        ).map((kind) => (
          <button
            key={kind}
            type="button"
            className="rounded border border-white/10 px-2 py-1 text-zinc-500 hover:text-cyan-300"
            onClick={() =>
              run(
                () =>
                  submitPlanFeedbackAction({ planId: plan.id, kind }),
                "Feedback registrado"
              )
            }
          >
            {kind}
          </button>
        ))}
      </div>
    </div>
  );
}

function Relation({
  title,
  id,
  href,
}: {
  title: string;
  id: string | null;
  href: (id: string) => string;
}) {
  return (
    <section className="rounded-lg border border-white/[0.06] p-3">
      <h2 className="text-[12px] font-medium text-zinc-300">{title}</h2>
      {!id ? (
        <p className="mt-1 text-[11px] text-zinc-600">—</p>
      ) : (
        <Link
          href={href(id)}
          className="mt-1 block text-[11px] text-zinc-400 hover:text-cyan-300"
        >
          {id}
        </Link>
      )}
    </section>
  );
}
