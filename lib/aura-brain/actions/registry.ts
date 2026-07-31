/**
 * Central Action Registry for Aura Brain — Sprint 8.1 consolidated.
 * Single registry. No parallel Action Registry.
 */

import type { AuraBrainActionDefinition } from "@/lib/aura-brain/actions/types";
import {
  draftFail,
  draftOk,
  requireString,
} from "@/lib/aura-brain/actions/validation";
import type { AutonomyLevel } from "@/lib/aura-brain/types";

const registry = new Map<string, AuraBrainActionDefinition>();

export function registerAction(action: AuraBrainActionDefinition): void {
  registry.set(action.id, action);
}

export function registerActions(actions: AuraBrainActionDefinition[]): void {
  for (const a of actions) registerAction(a);
}

export function clearActions(): void {
  registry.clear();
  builtinsReady = false;
}

export function getAction(id: string): AuraBrainActionDefinition | undefined {
  return registry.get(id);
}

export function listActions(): AuraBrainActionDefinition[] {
  return [...registry.values()];
}

function defaultSanitize(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const deny = [
    "token",
    "password",
    "secret",
    "apiKey",
    "api_key",
    "authorization",
    "creditCard",
    "credit_card",
    "ssn",
  ];
  for (const [k, v] of Object.entries(input)) {
    if (deny.some((d) => k.toLowerCase().includes(d.toLowerCase()))) {
      out[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string" && v.length > 200) {
      out[k] = `${v.slice(0, 200)}…`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

function levelsFromSupport(support: AutonomyLevel): AutonomyLevel[] {
  const order: AutonomyLevel[] = ["SUGGEST", "PREPARE", "CONFIRM", "AUTO_SAFE"];
  const idx = order.indexOf(support);
  return order.slice(0, Math.max(idx + 1, 1));
}

type DraftPartial = Omit<
  AuraBrainActionDefinition,
  | "validate"
  | "execute"
  | "version"
  | "supportedAutonomyLevels"
  | "requiresConfirmation"
  | "dailyLimit"
  | "cooldownMs"
  | "timeoutMs"
  | "inputSchema"
  | "outputSchema"
  | "sanitizeForAudit"
> & {
  version?: string;
  supportedAutonomyLevels?: AutonomyLevel[];
  requiresConfirmation?: boolean;
  dailyLimit?: number;
  cooldownMs?: number;
  timeoutMs?: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  validate?: AuraBrainActionDefinition["validate"];
  execute?: AuraBrainActionDefinition["execute"];
  prepare?: AuraBrainActionDefinition["prepare"];
  undo?: AuraBrainActionDefinition["undo"];
  sanitizeForAudit?: AuraBrainActionDefinition["sanitizeForAudit"];
  autoSafeEligible?: boolean;
};

function draftAction(partial: DraftPartial): AuraBrainActionDefinition {
  const requiresConfirmation =
    partial.requiresConfirmation ??
    (partial.autonomySupport === "CONFIRM" ||
      partial.riskLevel === "HIGH" ||
      partial.riskLevel === "CRITICAL" ||
      Boolean(partial.isFinancialFinal) ||
      Boolean(partial.isExternalComm) ||
      Boolean(partial.isDeletion) ||
      Boolean(partial.isPermissionChange));

  return {
    ...partial,
    version: partial.version ?? "1",
    supportedAutonomyLevels:
      partial.supportedAutonomyLevels ??
      levelsFromSupport(partial.autonomySupport),
    requiresConfirmation,
    dailyLimit: partial.dailyLimit ?? 20,
    cooldownMs: partial.cooldownMs ?? 60_000,
    timeoutMs: partial.timeoutMs ?? 15_000,
    inputSchema: partial.inputSchema ?? { type: "object" },
    outputSchema: partial.outputSchema ?? { type: "object" },
    autoSafeEligible:
      partial.autoSafeEligible ??
      (partial.riskLevel === "LOW" &&
        !partial.isFinancialFinal &&
        !partial.isExternalComm &&
        !partial.isDeletion &&
        !partial.isPermissionChange &&
        (partial.autonomySupport === "AUTO_SAFE" ||
          partial.autonomySupport === "PREPARE" ||
          partial.autonomySupport === "SUGGEST")),
    sanitizeForAudit: partial.sanitizeForAudit ?? defaultSanitize,
    validate:
      partial.validate ??
      (() => {
        return draftOk();
      }),
    prepare:
      partial.prepare ??
      (async (input) => ({
        ok: true,
        output: { prepared: true, draft: true, ...input },
        error: null,
      })),
    execute:
      partial.execute ??
      (async (ctx) => ({
        ok: true,
        output: { draft: true, ...ctx.input },
        error: null,
        undoToken: `undo_${Date.now()}`,
      })),
  };
}

/** Explicitly blocked — never registered for execution */
export const BLOCKED_ACTIONS_CATALOG = [
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
] as const;

export const BUILTIN_ACTIONS: AuraBrainActionDefinition[] = [
  draftAction({
    id: "create_calendar_event",
    name: "Criar evento (real)",
    module: "calendario",
    description: "Cria evento real no calendário — exige CONFIRM",
    riskLevel: "MEDIUM",
    reversibility: "hard",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "CONFIRM",
    requiresConfirmation: true,
    autoSafeEligible: false,
    validate: (input) => {
      if (!requireString(input, "titulo") && !requireString(input, "title")) {
        return draftFail("titulo obrigatório");
      }
      if (!requireString(input, "data_inicio") && !requireString(input, "start")) {
        return draftFail("data_inicio obrigatória");
      }
      return draftOk();
    },
  }),
  draftAction({
    id: "create_calendar_event_draft",
    name: "Rascunho de evento",
    module: "calendario",
    description: "Prepara rascunho de evento — sem publicar no calendário",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
  }),
  draftAction({
    id: "create_personal_task",
    name: "Criar tarefa operacional",
    module: "sistema",
    description: "Cria tarefa operacional real — exige CONFIRM",
    riskLevel: "MEDIUM",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "CONFIRM",
    requiresConfirmation: true,
    autoSafeEligible: false,
  }),
  draftAction({
    id: "create_personal_task_draft",
    name: "Rascunho de tarefa",
    module: "sistema",
    description: "Cria rascunho de tarefa pessoal",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
  }),
  draftAction({
    id: "complete_habit",
    name: "Concluir hábito",
    module: "habitos",
    description: "Marca hábito como concluído",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "habitId") ? draftOk() : draftFail("habitId obrigatório"),
    undo: async (ctx) => ({
      ok: true,
      output: { undone: true, habitId: ctx.input.habitId },
      error: null,
    }),
  }),
  draftAction({
    id: "update_goal_progress",
    name: "Atualizar objetivo",
    module: "objetivos",
    description: "Atualiza progresso de objetivo",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "goalId") ? draftOk() : draftFail("goalId obrigatório"),
  }),
  draftAction({
    id: "create_workout_plan_draft",
    name: "Rascunho de treino",
    module: "saude",
    description: "Prepara plano de treino sem executar",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "PREPARE",
    autoSafeEligible: true,
  }),
  draftAction({
    id: "create_financial_entry_draft",
    name: "Rascunho financeiro",
    module: "financeiro",
    description: "Prepara lançamento financeiro — nunca executa sozinho como final",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    isFinancial: true,
    isFinancialFinal: false,
    autoSafeEligible: true,
    requiresConfirmation: false,
  }),
  draftAction({
    id: "create_financial_entry_final",
    name: "Lançamento financeiro final",
    module: "financeiro",
    description: "Registra lançamento financeiro final — exige CONFIRM",
    riskLevel: "HIGH",
    reversibility: "none",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "CONFIRM",
    isFinancial: true,
    isFinancialFinal: true,
    requiresConfirmation: true,
    autoSafeEligible: false,
  }),
  draftAction({
    id: "create_business_idea_draft",
    name: "Ideia de negócio (rascunho)",
    module: "business_lab",
    description: "Estrutura ideia de negócio sem criar empresa",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "PREPARE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "title") || requireString(input, "titulo")
        ? draftOk()
        : draftFail("title obrigatório"),
  }),
  draftAction({
    id: "create_mission_reminder",
    name: "Lembrete de missão",
    module: "missions",
    description: "Lembrete interno para avançar missão",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "title") && requireString(input, "message")
        ? draftOk()
        : draftFail("title e message obrigatórios"),
  }),
  draftAction({
    id: "create_mission_task_draft",
    name: "Tarefa de missão (rascunho)",
    module: "missions",
    description: "Prepara tarefa ligada a uma missão sem efeitos colaterais",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "PREPARE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "missionId") || requireString(input, "title")
        ? draftOk()
        : draftFail("missionId ou title obrigatório"),
  }),
  draftAction({
    id: "create_content_idea_draft",
    name: "Ideia de conteúdo (rascunho)",
    module: "social",
    description: "Prepara ideia de conteúdo — nunca publica",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "PREPARE",
    autoSafeEligible: true,
  }),
  draftAction({
    id: "retry_expert_brain_document",
    name: "Retentar documento Expert Brain",
    module: "expert_brain",
    description: "Reprocessa documento com erro",
    riskLevel: "LOW",
    reversibility: "none",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "documentId")
        ? draftOk()
        : draftFail("documentId obrigatório"),
  }),
  draftAction({
    id: "mark_plan_step_complete",
    name: "Marcar etapa do plano como concluída",
    module: "planner",
    description: "Conclui etapa de plano de forma explícita e segura",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "planId") && requireString(input, "stepId")
        ? draftOk()
        : draftFail("planId e stepId obrigatórios"),
    undo: async (ctx) => ({
      ok: true,
      output: {
        undone: true,
        planId: ctx.input.planId,
        stepId: ctx.input.stepId,
      },
      error: null,
    }),
  }),
  draftAction({
    id: "create_plan_review_reminder",
    name: "Lembrete de revisão de plano",
    module: "planner",
    description: "Cria lembrete interno de revisão diária do plano",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
  }),
  draftAction({
    id: "assign_internal_plan_owner",
    name: "Atribuir responsável interno do plano",
    module: "planner",
    description: "Atribuição interna de responsável — não altera permissões",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "member",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "planId") && requireString(input, "ownerId")
        ? draftOk()
        : draftFail("planId e ownerId obrigatórios"),
    undo: async (ctx) => ({
      ok: true,
      output: { undone: true, planId: ctx.input.planId },
      error: null,
    }),
  }),
  draftAction({
    id: "modify_plan_deadline",
    name: "Modificar prazo de plano",
    module: "planner",
    description: "Altera prazo — exige CONFIRM",
    riskLevel: "MEDIUM",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "member",
    autonomySupport: "CONFIRM",
    requiresConfirmation: true,
    autoSafeEligible: false,
  }),
  draftAction({
    id: "update_project_status",
    name: "Atualizar status de projeto",
    module: "projects",
    description: "Atualiza status relevante de projeto — exige CONFIRM",
    riskLevel: "MEDIUM",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "member",
    autonomySupport: "CONFIRM",
    requiresConfirmation: true,
    autoSafeEligible: false,
  }),
  draftAction({
    id: "archive_internal_notification",
    name: "Arquivar notificação interna",
    module: "sistema",
    description: "Arquiva notificação interna (soft)",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    autoSafeEligible: true,
    validate: (input) =>
      requireString(input, "notificationId")
        ? draftOk()
        : draftFail("notificationId obrigatório"),
    undo: async (ctx) => ({
      ok: true,
      output: { undone: true, notificationId: ctx.input.notificationId },
      error: null,
    }),
  }),
  {
    id: "create_notification",
    version: "1",
    name: "Criar notificação interna",
    module: "sistema",
    description: "Notificação interna segura — sem e-mail/WhatsApp",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    supportedAutonomyLevels: ["SUGGEST", "PREPARE", "CONFIRM", "AUTO_SAFE"],
    requiresConfirmation: false,
    dailyLimit: 50,
    cooldownMs: 5_000,
    timeoutMs: 10_000,
    inputSchema: { type: "object", required: ["title", "message"] },
    outputSchema: { type: "object" },
    autoSafeEligible: true,
    sanitizeForAudit: defaultSanitize,
    validate: (input) => {
      if (!requireString(input, "title")) return draftFail("title obrigatório");
      if (!requireString(input, "message")) return draftFail("message obrigatório");
      return draftOk();
    },
    prepare: async (input) => ({
      ok: true,
      output: { prepared: true, ...input },
      error: null,
    }),
    execute: async (ctx) => {
      const title = requireString(ctx.input, "title")!;
      const message = requireString(ctx.input, "message")!;
      const type =
        requireString(ctx.input, "type") ?? "aura_brain_critical";
      const related_id = requireString(ctx.input, "related_id");
      if (related_id && ctx.adapters?.findUnreadNotification) {
        const exists = await ctx.adapters.findUnreadNotification({
          type,
          related_id,
        });
        if (exists) {
          return {
            ok: true,
            output: { skipped: true, reason: "already_notified" },
            error: null,
          };
        }
      }
      if (!ctx.adapters?.createNotification) {
        return {
          ok: true,
          output: {
            draft: true,
            title,
            message,
            type,
            related_id,
            notificationId: `notif_${Date.now()}`,
          },
          error: null,
          undoToken: `notif_${Date.now()}`,
        };
      }
      const res = await ctx.adapters.createNotification({
        title,
        message,
        type,
        related_module: requireString(ctx.input, "related_module"),
        related_id,
      });
      if (res.error) {
        return { ok: false, output: {}, error: res.error };
      }
      return {
        ok: true,
        output: { notificationId: res.id },
        error: null,
        undoToken: res.id,
      };
    },
    undo: async (ctx) => {
      const id =
        requireString(ctx.input, "notificationId") ??
        (typeof ctx.input.undoToken === "string" ? ctx.input.undoToken : null);
      if (id && ctx.adapters?.archiveNotification) {
        const res = await ctx.adapters.archiveNotification(id);
        if (!res.ok) return { ok: false, output: {}, error: res.error };
      }
      return {
        ok: true,
        output: { undone: true, notificationId: id },
        error: null,
      };
    },
  },
];

/** Alias id used by Sprint 8.1 naming */
function aliasInternalNotification(): AuraBrainActionDefinition {
  const base = BUILTIN_ACTIONS.find((a) => a.id === "create_notification")!;
  return { ...base, id: "create_internal_notification", name: "Criar notificação interna" };
}

let builtinsReady = false;

export function ensureBuiltinActions(): void {
  if (builtinsReady && registry.size > 0) return;
  registerActions([...BUILTIN_ACTIONS, aliasInternalNotification()]);
  builtinsReady = true;
}

export function isBlockedActionId(id: string): boolean {
  return (BLOCKED_ACTIONS_CATALOG as readonly string[]).includes(id);
}

export function sanitizeActionInput(
  actionId: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  ensureBuiltinActions();
  const def = getAction(actionId);
  return (def?.sanitizeForAudit ?? defaultSanitize)(input);
}
