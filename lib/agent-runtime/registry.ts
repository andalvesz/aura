/**
 * Agent Registry — five controlled V1 agents only.
 */

import type { AgentDefinition, AgentId } from "@/lib/agent-runtime/types";

const SAFE_DRAFT_ACTIONS = [
  "create_internal_notification",
  "create_notification",
  "create_personal_task_draft",
  "create_calendar_event_draft",
  "create_plan_review_reminder",
  "create_content_idea_draft",
  "create_business_idea_draft",
  "create_mission_task_draft",
  "archive_internal_notification",
];

const BLOCKED = [
  "send_email",
  "send_whatsapp",
  "publish_content",
  "make_payment",
  "buy_service",
  "delete_record",
  "change_permissions",
  "remove_member",
  "delete_workspace",
  "execute_arbitrary_code",
  "access_shell",
  "autonomous_external_research",
  "create_financial_entry_final",
];

const registry = new Map<AgentId, AgentDefinition>();

export function registerAgent(def: AgentDefinition): void {
  registry.set(def.id, def);
}

export function clearAgentRegistry(): void {
  registry.clear();
  ready = false;
}

export function getAgentDefinition(id: string): AgentDefinition | undefined {
  return registry.get(id as AgentId);
}

export function listAgentDefinitions(): AgentDefinition[] {
  return [...registry.values()];
}

export const BUILTIN_AGENTS: AgentDefinition[] = [
  {
    id: "daily_organizer_v1",
    version: "1",
    name: "Daily Organizer",
    description: "Organiza Meu Dia com rascunhos e notificações internas",
    purpose: "Revisar dia, planos e prioridades confirmadas sem alterar agenda sozinho",
    allowedContexts: ["personal", "workspace"],
    allowedActionIds: [
      "create_internal_notification",
      "create_notification",
      "create_personal_task_draft",
      "create_calendar_event_draft",
      "create_plan_review_reminder",
    ],
    blockedActionIds: BLOCKED,
    maximumRiskLevel: "LOW",
    supportedAutonomyLevels: ["SUGGEST", "PREPARE", "CONFIRM", "AUTO_SAFE"],
    requiredRoles: ["any"],
    maximumSteps: 6,
    maximumDurationMs: 5 * 60_000,
    maximumActions: 4,
    maximumRetries: 2,
    requiresApprovedPlan: false,
    contextBudget: 40,
    memoryPolicy: "eligible_read",
    verificationPolicy: "basic",
    stopConditions: ["budget", "no_pending_steps", "user_cancel", "policy_block"],
    enabledByDefault: false,
  },
  {
    id: "plan_assistant_v1",
    version: "1",
    name: "Plan Assistant",
    description: "Assiste planos aprovados com automações e progresso controlado",
    purpose: "Analisar plano aprovado e preparar ações registradas",
    allowedContexts: ["personal", "workspace"],
    allowedActionIds: [
      "create_internal_notification",
      "create_plan_review_reminder",
      "create_personal_task_draft",
      "mark_plan_step_complete",
      "assign_internal_plan_owner",
    ],
    blockedActionIds: BLOCKED,
    maximumRiskLevel: "LOW",
    supportedAutonomyLevels: ["SUGGEST", "PREPARE", "CONFIRM", "AUTO_SAFE"],
    requiredRoles: ["any", "member", "editor", "owner"],
    maximumSteps: 8,
    maximumDurationMs: 8 * 60_000,
    maximumActions: 5,
    maximumRetries: 2,
    requiresApprovedPlan: true,
    contextBudget: 50,
    memoryPolicy: "confirmed_only",
    verificationPolicy: "strict",
    stopConditions: ["budget", "plan_complete", "waiting_input", "policy_block"],
    enabledByDefault: false,
  },
  {
    id: "project_review_v1",
    version: "1",
    name: "Project Review",
    description: "Revisa projeto, riscos e próximos passos",
    purpose: "Resumir riscos e preparar revisão interna",
    allowedContexts: ["personal", "workspace"],
    allowedActionIds: [
      "create_internal_notification",
      "create_personal_task_draft",
      "create_plan_review_reminder",
    ],
    blockedActionIds: BLOCKED,
    maximumRiskLevel: "LOW",
    supportedAutonomyLevels: ["SUGGEST", "PREPARE", "CONFIRM", "AUTO_SAFE"],
    requiredRoles: ["any", "member", "editor", "owner"],
    maximumSteps: 5,
    maximumDurationMs: 5 * 60_000,
    maximumActions: 3,
    maximumRetries: 2,
    requiresApprovedPlan: false,
    contextBudget: 40,
    memoryPolicy: "eligible_read",
    verificationPolicy: "basic",
    stopConditions: ["budget", "review_prepared", "policy_block"],
    enabledByDefault: false,
  },
  {
    id: "knowledge_organizer_v1",
    version: "1",
    name: "Knowledge Organizer",
    description: "Organiza conhecimento sem apagar conteúdo",
    purpose: "Relacionar documentos, sugerir tags e pedir revisão",
    allowedContexts: ["personal", "workspace"],
    allowedActionIds: [
      "create_internal_notification",
      "create_personal_task_draft",
      "create_content_idea_draft",
    ],
    blockedActionIds: [...BLOCKED, "archive_internal_notification"],
    maximumRiskLevel: "LOW",
    supportedAutonomyLevels: ["SUGGEST", "PREPARE", "CONFIRM", "AUTO_SAFE"],
    requiredRoles: ["any"],
    maximumSteps: 5,
    maximumDurationMs: 5 * 60_000,
    maximumActions: 3,
    maximumRetries: 1,
    requiresApprovedPlan: false,
    contextBudget: 35,
    memoryPolicy: "eligible_read",
    verificationPolicy: "basic",
    stopConditions: ["budget", "org_prepared", "policy_block", "never_delete"],
    enabledByDefault: false,
  },
  {
    id: "business_preparation_v1",
    version: "1",
    name: "Business Preparation",
    description: "Prepara hipóteses e rascunhos de negócio",
    purpose: "Estruturar ideia sem criar empresa, pagar ou publicar",
    allowedContexts: ["personal", "workspace"],
    allowedActionIds: [
      "create_business_idea_draft",
      "create_content_idea_draft",
      "create_personal_task_draft",
      "create_internal_notification",
      "create_mission_task_draft",
    ],
    blockedActionIds: BLOCKED,
    maximumRiskLevel: "LOW",
    supportedAutonomyLevels: ["SUGGEST", "PREPARE", "CONFIRM", "AUTO_SAFE"],
    requiredRoles: ["any", "member", "owner"],
    maximumSteps: 6,
    maximumDurationMs: 6 * 60_000,
    maximumActions: 4,
    maximumRetries: 2,
    requiresApprovedPlan: false,
    contextBudget: 40,
    memoryPolicy: "eligible_read",
    verificationPolicy: "basic",
    stopConditions: [
      "budget",
      "draft_ready",
      "policy_block",
      "no_company_creation",
      "no_payment",
      "no_publish",
    ],
    enabledByDefault: false,
  },
];

let ready = false;

export function ensureBuiltinAgents(): void {
  if (ready && registry.size > 0) return;
  for (const a of BUILTIN_AGENTS) registerAgent(a);
  ready = true;
}

export function isActionAllowedForAgent(
  agent: AgentDefinition,
  actionId: string
): boolean {
  if (agent.blockedActionIds.includes(actionId)) return false;
  if (BLOCKED.includes(actionId)) return false;
  return agent.allowedActionIds.includes(actionId);
}

export { SAFE_DRAFT_ACTIONS, BLOCKED as GLOBALLY_BLOCKED_ACTIONS };
