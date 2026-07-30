/**
 * Pure helpers for context-aware dashboard (unit-testable, no I/O).
 */

import type { WorkspaceRole } from "@/lib/workspace/constants";
import { canManageMembers, canDeleteWorkspace } from "@/lib/workspace/constants";

export type DashboardMode = "personal" | "workspace";

export function resolveDashboardMode(params: {
  activeContext: "personal" | "workspace";
  activeWorkspaceId: string | null;
  hasActiveMembership: boolean;
}): DashboardMode {
  if (
    params.activeContext === "workspace" &&
    params.activeWorkspaceId &&
    params.hasActiveMembership
  ) {
    return "workspace";
  }
  return "personal";
}

export type DashboardQuickAction = {
  id: string;
  label: string;
  href?: string;
  action?: "modal";
  modal?: string;
  ownerOnly?: boolean;
  adminOrOwner?: boolean;
};

export const PERSONAL_QUICK_ACTIONS: DashboardQuickAction[] = [
  { id: "add-expense", label: "Adicionar despesa", action: "modal", modal: "gasto" },
  { id: "add-income", label: "Adicionar receita", action: "modal", modal: "receita" },
  { id: "add-event", label: "Criar evento", action: "modal", modal: "evento" },
  { id: "add-goal", label: "Criar objetivo", action: "modal", modal: "goal" },
  { id: "add-habit", label: "Registrar hábito", action: "modal", modal: "habit" },
  { id: "open-health", label: "Abrir saúde", href: "/dashboard/saude" },
  { id: "open-expert", label: "Abrir Expert Brain", href: "/dashboard/expert-brain" },
];

export const WORKSPACE_QUICK_ACTIONS: DashboardQuickAction[] = [
  { id: "add-cliente", label: "Novo cliente", action: "modal", modal: "cliente" },
  { id: "add-lead", label: "Novo lead (Crescimento)", href: "/dashboard/crescimento" },
  { id: "add-orcamento", label: "Novo orçamento", action: "modal", modal: "orcamento" },
  { id: "add-proposta", label: "Nova proposta", href: "/dashboard/alvesz" },
  { id: "add-evento-ws", label: "Novo evento", action: "modal", modal: "alvesz-evento" },
  { id: "open-estoque", label: "Abrir estoque", href: "/dashboard/alvesz" },
  {
    id: "manage-team",
    label: "Gerenciar equipe",
    href: "/dashboard/workspace",
    adminOrOwner: true,
  },
];

export function filterQuickActionsForRole(
  actions: DashboardQuickAction[],
  role: WorkspaceRole | null
): DashboardQuickAction[] {
  return actions.filter((a) => {
    if (a.ownerOnly && !canDeleteWorkspace(role)) return false;
    if (a.adminOrOwner && !canManageMembers(role)) return false;
    return true;
  });
}

/** Avoid showing a metric card with a misleading absolute zero when data is absent. */
export function formatOptionalMetric(
  value: number | null | undefined,
  formatter: (n: number) => string,
  emptyLabel = "—"
): { display: string; hasData: boolean } {
  if (value == null || Number.isNaN(Number(value))) {
    return { display: emptyLabel, hasData: false };
  }
  return { display: formatter(Number(value)), hasData: true };
}

export function isSameLocalDay(isoDate: string, ref = new Date()): boolean {
  const day = isoDate.slice(0, 10);
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, "0");
  const d = String(ref.getDate()).padStart(2, "0");
  return day === `${y}-${m}-${d}`;
}
