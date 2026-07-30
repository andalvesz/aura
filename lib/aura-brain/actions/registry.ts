/**
 * Central Action Registry for Aura Brain.
 */

import type { AuraBrainActionDefinition } from "@/lib/aura-brain/actions/types";
import {
  draftFail,
  draftOk,
  requireString,
} from "@/lib/aura-brain/actions/validation";

const registry = new Map<string, AuraBrainActionDefinition>();

export function registerAction(action: AuraBrainActionDefinition): void {
  registry.set(action.id, action);
}

export function registerActions(actions: AuraBrainActionDefinition[]): void {
  for (const a of actions) registerAction(a);
}

export function clearActions(): void {
  registry.clear();
}

export function getAction(id: string): AuraBrainActionDefinition | undefined {
  return registry.get(id);
}

export function listActions(): AuraBrainActionDefinition[] {
  return [...registry.values()];
}

function draftAction(
  partial: Omit<AuraBrainActionDefinition, "validate" | "execute"> & {
    validate?: AuraBrainActionDefinition["validate"];
    execute?: AuraBrainActionDefinition["execute"];
  }
): AuraBrainActionDefinition {
  return {
    ...partial,
    validate:
      partial.validate ??
      ((input) => {
        const title = requireString(input, "title") ?? requireString(input, "titulo");
        if (!title && partial.id.includes("draft")) return draftOk();
        return draftOk();
      }),
    execute:
      partial.execute ??
      (async (ctx) => ({
        ok: true,
        output: { draft: true, ...ctx.input },
        error: null,
        undoToken: null,
      })),
  };
}

export const BUILTIN_ACTIONS: AuraBrainActionDefinition[] = [
  draftAction({
    id: "create_calendar_event",
    name: "Criar evento",
    module: "calendario",
    description: "Cria evento no calendário pessoal",
    riskLevel: "MEDIUM",
    reversibility: "hard",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "CONFIRM",
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
    id: "create_personal_task",
    name: "Criar tarefa",
    module: "sistema",
    description: "Cria tarefa pessoal (rascunho)",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "PREPARE",
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
    autonomySupport: "CONFIRM",
    validate: (input) =>
      requireString(input, "habitId") ? draftOk() : draftFail("habitId obrigatório"),
  }),
  draftAction({
    id: "update_goal_progress",
    name: "Atualizar objetivo",
    module: "objetivos",
    description: "Atualiza progresso de objetivo",
    riskLevel: "MEDIUM",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "CONFIRM",
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
  }),
  draftAction({
    id: "create_financial_entry_draft",
    name: "Rascunho financeiro",
    module: "financeiro",
    description: "Prepara lançamento financeiro — nunca executa sozinho",
    riskLevel: "HIGH",
    reversibility: "none",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "CONFIRM",
    isFinancial: true,
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
    validate: (input) =>
      requireString(input, "title") || requireString(input, "titulo")
        ? draftOk()
        : draftFail("title obrigatório"),
  }),
  draftAction({
    id: "create_mission_reminder",
    name: "Lembrete de missão",
    module: "missions",
    description: "Lembrete interno para avançar missão — nunca executa risco alto",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
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
    validate: (input) =>
      requireString(input, "missionId") || requireString(input, "title")
        ? draftOk()
        : draftFail("missionId ou title obrigatório"),
  }),
  draftAction({
    id: "create_content_idea_draft",
    name: "Ideia de conteúdo (rascunho)",
    module: "social",
    description: "Prepara ideia de conteúdo",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "PREPARE",
  }),
  draftAction({
    id: "retry_expert_brain_document",
    name: "Retentar documento Expert Brain",
    module: "expert_brain",
    description: "Reprocessa documento com erro — exige confirmação",
    riskLevel: "MEDIUM",
    reversibility: "none",
    allowedContexts: ["personal"],
    requiredRole: "any",
    autonomySupport: "CONFIRM",
    validate: (input) =>
      requireString(input, "documentId")
        ? draftOk()
        : draftFail("documentId obrigatório"),
  }),
  {
    id: "create_notification",
    name: "Criar notificação interna",
    module: "sistema",
    description: "Notificação interna segura — sem e-mail/WhatsApp",
    riskLevel: "LOW",
    reversibility: "soft",
    allowedContexts: ["personal", "workspace"],
    requiredRole: "any",
    autonomySupport: "AUTO_SAFE",
    validate: (input) => {
      if (!requireString(input, "title")) return draftFail("title obrigatório");
      if (!requireString(input, "message")) return draftFail("message obrigatório");
      return draftOk();
    },
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
          },
          error: null,
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
      return {
        ok: true,
        output: { undone: true, notificationId: ctx.input.notificationId },
        error: null,
      };
    },
  },
];

let builtinsReady = false;

export function ensureBuiltinActions(): void {
  if (builtinsReady && registry.size > 0) return;
  registerActions(BUILTIN_ACTIONS);
  builtinsReady = true;
}
