/**
 * Context resolver — minimal, budgeted, isolated reads from orchestrator slices.
 */

import type { GlobalContext } from "@/lib/orchestrator/types";
import { CONVERSATION_BUDGET } from "@/lib/conversation/conversation-policy";
import type {
  ConversationContextFocus,
  ConversationResolvedContext,
  ConversationSourceRef,
  ConversationViewer,
} from "@/lib/conversation/types";

export type ContextResolverInput = {
  viewer: ConversationViewer;
  focus: ConversationContextFocus;
  global?: GlobalContext | null;
  extraSources?: ConversationSourceRef[];
  now?: string;
};

function focusLabel(focus: ConversationContextFocus): string {
  if (focus.label) return focus.label;
  if (focus.planId) return `Plano ${focus.planId.slice(0, 8)}`;
  if (focus.projectId) return `Projeto ${focus.projectId.slice(0, 8)}`;
  if (focus.missionId) return `Missão ${focus.missionId.slice(0, 8)}`;
  if (focus.businessId) return `Empresa ${focus.businessId.slice(0, 8)}`;
  if (focus.contextMode === "workspace" && focus.workspaceId)
    return `Workspace ${focus.workspaceId.slice(0, 8)}`;
  return "Pessoal";
}

export function buildConversationFocus(
  partial: Partial<ConversationContextFocus> = {}
): ConversationContextFocus {
  const focus: ConversationContextFocus = {
    workspaceId: partial.workspaceId ?? null,
    projectId: partial.projectId ?? null,
    missionId: partial.missionId ?? null,
    businessId: partial.businessId ?? null,
    planId: partial.planId ?? null,
    contextMode: partial.contextMode ?? (partial.workspaceId ? "workspace" : "personal"),
    label: partial.label ?? "",
  };
  focus.label = focusLabel(focus);
  return focus;
}

/**
 * Resolve read-only context. Filters cross-user private data.
 * Never trusts client-only claims — viewer + server focus win.
 */
export function resolveConversationContext(
  input: ContextResolverInput
): ConversationResolvedContext {
  const focus = buildConversationFocus({
    ...input.focus,
    workspaceId:
      input.viewer.workspaceId && input.focus.contextMode === "workspace"
        ? input.viewer.workspaceId
        : input.focus.contextMode === "personal"
          ? null
          : input.focus.workspaceId,
  });

  const sources: ConversationSourceRef[] = [];
  const gaps: string[] = [];
  const g = input.global;

  const pushHint = (
    kind: string,
    hrefFallback: string,
    hint: { id: string; label: string; href?: string | null } | null | undefined
  ) => {
    if (!hint) return;
    sources.push({
      id: hint.id,
      kind,
      title: hint.label,
      href: hint.href ?? hrefFallback,
      confirmedByUser: false,
    });
  };

  if (g) {
    pushHint("user", "/dashboard/settings/identity", g.slice.user);
    pushHint("workspace", "/dashboard", g.slice.workspace);
    pushHint("project", "/dashboard/projects", g.slice.activeProject);
    pushHint("mission", "/dashboard/missions", g.slice.activeMission);
    pushHint("plan", "/dashboard/plans", g.slice.activePlan);
    for (const p of g.slice.priorities.slice(0, 5)) {
      pushHint("priority", "/dashboard/priorities", p);
    }
    for (const r of g.slice.risks.slice(0, 5)) {
      pushHint("risk", "/dashboard/priorities", r);
    }
    for (const o of g.slice.opportunities.slice(0, 5)) {
      pushHint("opportunity", "/dashboard/recommendations", o);
    }
    for (const a of g.slice.nextActions.slice(0, 5)) {
      pushHint("next_action", "/dashboard", a);
    }
    for (const a of g.slice.activeAgents.slice(0, 3)) {
      pushHint("agent", "/dashboard/agents", a);
    }
    for (const a of g.slice.automations.slice(0, 3)) {
      pushHint("automation", "/dashboard/automations", a);
    }
    gaps.push(...g.dataCompleteness.gaps);
  } else {
    gaps.push("no_global_context");
  }

  for (const s of input.extraSources ?? []) {
    // Isolation: reject foreign workspace hints when personal
    if (
      focus.contextMode === "personal" &&
      s.kind === "workspace_private_other_user"
    ) {
      continue;
    }
    sources.push(s);
  }

  const limited = sources.slice(0, CONVERSATION_BUDGET.maxSources);

  return {
    focus,
    sources: limited,
    budgetUsed: limited.length,
    budgetMax: CONVERSATION_BUDGET.maxSources,
    gaps: [...new Set(gaps)],
    isolationOk: true,
    generatedAt: input.now ?? new Date().toISOString(),
  };
}

export function filterPrivateMemberData(
  sources: ConversationSourceRef[],
  opts: { allowWorkspaceShared: boolean }
): ConversationSourceRef[] {
  return sources.filter((s) => {
    if (s.kind === "member_private") return false;
    if (s.kind === "personal_other_user") return false;
    if (!opts.allowWorkspaceShared && s.kind === "workspace_activity") return false;
    return true;
  });
}
