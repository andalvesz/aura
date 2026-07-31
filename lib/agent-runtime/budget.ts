import type { AgentSession } from "@/lib/agent-runtime/types";

export type BudgetCheck = {
  ok: boolean;
  failures: string[];
  remaining: { steps: number; actions: number; timeMs: number };
};

export function checkBudgets(
  session: AgentSession,
  now = Date.now()
): BudgetCheck {
  const failures: string[] = [];
  const elapsed = session.startedAt
    ? now - Date.parse(session.startedAt)
    : 0;
  const remaining = {
    steps: Math.max(0, session.stepBudget - session.stepsUsed),
    actions: Math.max(0, session.actionBudget - session.actionsUsed),
    timeMs: Math.max(0, session.timeBudgetMs - elapsed),
  };
  if (remaining.steps <= 0) failures.push("step_budget_exceeded");
  if (remaining.actions <= 0) failures.push("action_budget_exceeded");
  if (remaining.timeMs <= 0 && session.startedAt)
    failures.push("time_budget_exceeded");
  return { ok: failures.length === 0, failures, remaining };
}

export function formatBudgetReport(session: AgentSession): {
  steps: string;
  actions: string;
  time: string;
} {
  const b = checkBudgets(session);
  return {
    steps: `${session.stepsUsed}/${session.stepBudget}`,
    actions: `${session.actionsUsed}/${session.actionBudget}`,
    time: `${Math.round((session.timeBudgetMs - b.remaining.timeMs) / 1000)}s/${Math.round(session.timeBudgetMs / 1000)}s`,
  };
}
