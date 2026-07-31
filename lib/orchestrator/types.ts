/**
 * Sprint 9.0 — Aura Brain Operating System (Orchestrator).
 * Coordinates existing modules. Does not replace Planner, Agent Runtime, or Brain.
 */

export type OrchestratorModuleId =
  | "identity"
  | "memory"
  | "world"
  | "knowledge"
  | "cognitive"
  | "discovery"
  | "decision"
  | "scenario"
  | "prioritization"
  | "recommendation"
  | "planner"
  | "automation"
  | "agent-runtime"
  | "projects"
  | "missions"
  | "business";

export type TimelineSourceKind =
  | "memory"
  | "knowledge"
  | "discovery"
  | "decision"
  | "recommendation"
  | "plan"
  | "automation"
  | "agent"
  | "priority"
  | "scenario"
  | "project"
  | "world"
  | "insight";

export type AuraHomeWidgetId =
  | "today"
  | "next-actions"
  | "projects"
  | "missions"
  | "alerts"
  | "discoveries"
  | "plans"
  | "agents"
  | "automations"
  | "priorities"
  | "recommendations"
  | "knowledge"
  | "timeline"
  | "quick-actions";

export type CommunicationTone =
  | "direct"
  | "warm"
  | "formal"
  | "coach"
  | "concise";

export type CommunicationLanguage = "pt-BR" | "en" | "es";

/** Personality prefs — NOT Identity Engine. Stored with orchestrator/settings. */
export type AuraPersonality = {
  style: string;
  objectives: string[];
  preferences: string[];
  language: CommunicationLanguage;
  tone: CommunicationTone;
};

export const DEFAULT_AURA_PERSONALITY: AuraPersonality = {
  style: "claro e orientado a ação",
  objectives: [],
  preferences: [],
  language: "pt-BR",
  tone: "direct",
};

export type SessionFocus = {
  workspaceId: string | null;
  projectId: string | null;
  missionId: string | null;
  businessId: string | null;
  planId: string | null;
  contextMode: "personal" | "workspace";
};

export const EMPTY_SESSION_FOCUS: SessionFocus = {
  workspaceId: null,
  projectId: null,
  missionId: null,
  businessId: null,
  planId: null,
  contextMode: "personal",
};

export type ContextHint = {
  id: string;
  label: string;
  href?: string | null;
  score?: number;
  meta?: Record<string, string | number | boolean | null>;
};

export type GlobalContextSlice = {
  user: ContextHint | null;
  workspace: ContextHint | null;
  activeProject: ContextHint | null;
  activeMission: ContextHint | null;
  activePlan: ContextHint | null;
  activeBusiness: ContextHint | null;
  priorities: ContextHint[];
  activeAgents: ContextHint[];
  automations: ContextHint[];
  risks: ContextHint[];
  opportunities: ContextHint[];
  recommendations: ContextHint[];
  discoveries: ContextHint[];
  nextActions: ContextHint[];
};

export type GlobalContext = {
  slice: GlobalContextSlice;
  session: SessionFocus;
  personality: AuraPersonality;
  answers: {
    whoIsTheUser: string;
    whichWorkspace: string;
    whichActiveProject: string;
    whichMission: string;
    whichPlan: string;
    whichPriorities: string[];
    whichActiveAgents: string[];
    whichAutomations: string[];
    whichRisks: string[];
    whichOpportunities: string[];
  };
  dataCompleteness: {
    score: number;
    gaps: string[];
    sampleSize: number;
  };
  generatedAt: string;
  correlationId: string;
  readOnly: true;
};

export type TimelineEntry = {
  id: string;
  source: TimelineSourceKind;
  title: string;
  summary: string;
  at: string;
  href: string;
  moduleId: OrchestratorModuleId;
  sourceId?: string;
};

export type SmartLink = {
  id: string;
  kind: TimelineSourceKind | "mission" | "business";
  title: string;
  href: string;
  reason: string;
};

export type SmartLinksBundle = {
  memories: SmartLink[];
  documents: SmartLink[];
  plans: SmartLink[];
  discovery: SmartLink[];
  knowledge: SmartLink[];
  decisions: SmartLink[];
  recommendations: SmartLink[];
  agents: SmartLink[];
  automations: SmartLink[];
};

export type CommandIntentKind =
  | "open_project"
  | "show_risks"
  | "open_discovery"
  | "create_memory"
  | "execute_plan"
  | "open_agent"
  | "search_document"
  | "open_plans"
  | "open_automations"
  | "open_home"
  | "open_recommendations"
  | "open_priorities"
  | "open_missions"
  | "search_nl"
  | "unknown";

export type CommandIntent = {
  kind: CommandIntentKind;
  confidence: number;
  href: string;
  label: string;
  searchQuery: string | null;
  filterHint: string | null;
};

export type NaturalSearchIntent = {
  raw: string;
  cleanedQuery: string;
  entityHints: string[];
  statusHints: string[];
  topicHints: string[];
  filter: "todos" | "aura" | "leads" | "eventos" | "conteudo" | "saude" | "financeiro" | "ia";
  hrefFallback: string | null;
};

export type WidgetPriority = {
  id: AuraHomeWidgetId;
  score: number;
  reason: string;
  visible: true;
};

export type QuickAction = {
  id: string;
  label: string;
  href: string;
  kind: CommandIntentKind | "custom";
};

export type AuraHomeModel = {
  title: string;
  subtitle: string;
  context: GlobalContext;
  widgetOrder: WidgetPriority[];
  quickActions: QuickAction[];
  timeline: TimelineEntry[];
  generatedAt: string;
};

export type CrossNavLink = {
  fromModule: OrchestratorModuleId;
  toModule: OrchestratorModuleId;
  label: string;
  href: string;
};
