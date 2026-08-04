/**
 * Sprint 9.1 — Conversational Command Center contracts.
 * Coordinates existing modules. Does not replace Brain / Planner / Automation / Agent Runtime.
 * Operational actions never bypass Action Registry, confirmation, autonomy, or audit.
 */

import type { ActionRiskLevel } from "@/lib/aura-brain/types";
import type { SessionFocus } from "@/lib/orchestrator/types";

export type ConversationIntentKind =
  | "NAVIGATE"
  | "SEARCH"
  | "SUMMARIZE"
  | "EXPLAIN"
  | "COMPARE"
  | "REVIEW"
  | "ASK_STATUS"
  | "CREATE_DRAFT"
  | "PROPOSE_PLAN"
  | "PROPOSE_AUTOMATION"
  | "START_AGENT_SESSION"
  | "CONFIRM_ACTION"
  | "CANCEL_ACTION"
  | "PROVIDE_INPUT"
  | "UPDATE_CONTEXT"
  | "UNKNOWN";

export type ConversationTargetType =
  | "home"
  | "project"
  | "business"
  | "mission"
  | "plan"
  | "recommendation"
  | "decision"
  | "scenario"
  | "priority"
  | "automation"
  | "agent"
  | "document"
  | "memory"
  | "discovery"
  | "workspace"
  | "skill"
  | "capability"
  | "day"
  | "week"
  | "none";

export type ConversationActionability =
  | "none"
  | "navigate"
  | "search"
  | "draft"
  | "propose"
  | "confirm"
  | "explain";

export type ConversationMessageRole = "user" | "assistant" | "system";

export type ConversationStatus =
  | "ACTIVE"
  | "WAITING_CONFIRMATION"
  | "ARCHIVED"
  | "DELETED";

export type MemoryPromotionChoice =
  | "none"
  | "conversation_only"
  | "project"
  | "workspace"
  | "save_as_memory";

export type ConversationCitation = {
  id: string;
  label: string;
  href: string;
  kind: string;
  confirmedByUser: boolean;
};

export type ConversationIntent = {
  id: string;
  kind: ConversationIntentKind;
  confidence: number;
  entities: string[];
  targetType: ConversationTargetType;
  targetId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  missionId: string | null;
  planId: string | null;
  actionability: ConversationActionability;
  requiresConfirmation: boolean;
  allowedHandlers: string[];
  ambiguity: string[];
  missingInformation: string[];
  query: string;
  navigationHref: string | null;
};

export type ConversationContextFocus = SessionFocus & {
  label: string;
};

export type ConversationSourceRef = {
  id: string;
  kind: string;
  title: string;
  href: string;
  snippet?: string;
  confirmedByUser?: boolean;
};

export type ConversationResolvedContext = {
  focus: ConversationContextFocus;
  sources: ConversationSourceRef[];
  budgetUsed: number;
  budgetMax: number;
  gaps: string[];
  isolationOk: true;
  generatedAt: string;
};

export type ConversationDraftKind =
  | "plan"
  | "memory"
  | "note"
  | "business_idea"
  | "content"
  | "event"
  | "finance"
  | "automation"
  | "internal_reply";

export type ConversationDraft = {
  id: string;
  kind: ConversationDraftKind;
  title: string;
  preview: string;
  payload: Record<string, unknown>;
  riskLevel: ActionRiskLevel;
  requiresConfirmation: boolean;
  status: "PREVIEW" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
};

export type ConversationPendingAction = {
  id: string;
  kind:
    | "save_draft"
    | "propose_plan"
    | "propose_automation"
    | "start_agent"
    | "save_memory"
    | "navigate";
  title: string;
  origin: string;
  changesSummary: string;
  riskLevel: ActionRiskLevel;
  reversibility: "reversible" | "partial" | "irreversible";
  expiresAt: string;
  payloadHash: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED" | "BLOCKED";
};

export type ConversationExplanation = {
  why: string;
  evidence: string[];
  rules: string[];
  sources: ConversationCitation[];
  premises: string[];
  limitations: string[];
  confidence: number;
  missing: string[];
  alternativeInterpretations: string[];
  executedAnything: false | true;
  executedSummary: string | null;
  confirmedByUser: boolean;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  intentKind: ConversationIntentKind | null;
  citations: ConversationCitation[];
  draftIds: string[];
  pendingActionIds: string[];
  navigationHref: string | null;
  explanation: ConversationExplanation | null;
  createdAt: string;
  softDeleted: boolean;
};

export type ConversationRecord = {
  id: string;
  userId: string;
  ownerId: string;
  workspaceId: string | null;
  title: string;
  status: ConversationStatus;
  focus: ConversationContextFocus;
  messageIds: string[];
  draftIds: string[];
  pendingActionIds: string[];
  memoryChoice: MemoryPromotionChoice;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  softDeleted: boolean;
  rowVersion: number;
};

export type ConversationAuditEvent =
  | "conversation_started"
  | "intent_classified"
  | "context_resolved"
  | "sources_loaded"
  | "response_generated"
  | "draft_prepared"
  | "confirmation_presented"
  | "navigation_triggered"
  | "agent_session_proposed"
  | "provider_invoked"
  | "provider_failed"
  | "injection_blocked"
  | "policy_blocked"
  | "conversation_archived"
  | "conversation_deleted"
  | "action_confirmed"
  | "action_cancelled";

export type ConversationAuditEntry = {
  id: string;
  conversationId: string | null;
  userId: string;
  workspaceId: string | null;
  event: ConversationAuditEvent;
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type ConversationViewer = {
  userId: string;
  workspaceId: string | null;
  role: "owner" | "admin" | "member" | "viewer" | null;
  isWorkspaceMember: boolean;
};

export type ConversationState = {
  conversations: ConversationRecord[];
  messages: ConversationMessage[];
  drafts: ConversationDraft[];
  pendingActions: ConversationPendingAction[];
  audits: ConversationAuditEntry[];
};

export type HandleConversationInput = {
  conversationId?: string | null;
  message: string;
  viewer: ConversationViewer;
  focus?: Partial<ConversationContextFocus>;
  confirmActionId?: string | null;
  cancelActionId?: string | null;
  memoryChoice?: MemoryPromotionChoice;
  now?: string;
};

export type HandleConversationResult = {
  ok: boolean;
  error: string | null;
  conversation: ConversationRecord | null;
  assistantMessage: ConversationMessage | null;
  intent: ConversationIntent | null;
  context: ConversationResolvedContext | null;
  pendingAction: ConversationPendingAction | null;
  draft: ConversationDraft | null;
  navigationHref: string | null;
  blockedReason: string | null;
};

export const QUICK_STARTS: Array<{ id: string; label: string; prompt: string }> = [
  { id: "qs-day", label: "Organize meu dia", prompt: "O que merece minha atenção hoje?" },
  { id: "qs-ws", label: "Resuma meu workspace", prompt: "Resuma meu workspace." },
  { id: "qs-risk", label: "Mostre riscos", prompt: "Quais riscos existem agora?" },
  {
    id: "qs-dec",
    label: "Decisões para revisão",
    prompt: "Quais decisões ainda precisam de revisão?",
  },
  { id: "qs-docs", label: "Encontre documentos", prompt: "Encontre documentos relacionados." },
  { id: "qs-proj", label: "Revise um projeto", prompt: "Resuma o projeto ativo." },
  {
    id: "qs-plan",
    label: "Recomendação → plano",
    prompt: "Crie um rascunho de plano a partir da recomendação atual.",
  },
  {
    id: "qs-auto",
    label: "Prepare automação",
    prompt: "Prepare uma automação para esta etapa.",
  },
];

export const ROUTE_REGISTRY: Record<string, string> = {
  home: "/dashboard",
  brain: "/dashboard/brain",
  projects: "/dashboard/projects",
  business: "/dashboard/business",
  "business-expert": "/dashboard/business-expert",
  missions: "/dashboard/missions",
  plans: "/dashboard/plans",
  automations: "/dashboard/automations",
  agents: "/dashboard/agents",
  priorities: "/dashboard/priorities",
  recommendations: "/dashboard/recommendations",
  decisions: "/dashboard/decisions",
  scenarios: "/dashboard/scenarios",
  discovery: "/dashboard/discovery",
  knowledge: "/dashboard/knowledge",
  memory: "/dashboard/settings/memory",
  inbox: "/dashboard/inbox",
  skills: "/dashboard/skills",
  capabilities: "/dashboard/settings/capabilities",
  workspace: "/dashboard/workspace",
  learning: "/dashboard/learning",
};
