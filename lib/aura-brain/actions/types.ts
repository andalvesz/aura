/**
 * Extend Action Registry types for Sprint 8.1 contracts.
 * Consolidates — does not create a second registry.
 */

import type {
  ActionRiskLevel,
  AutonomyLevel,
  AuraBrainContextMode,
} from "@/lib/aura-brain/types";

export type ActionReversibility = "none" | "soft" | "hard";

export type AuraBrainActionDefinition = {
  id: string;
  version: string;
  name: string;
  module: string;
  description: string;
  riskLevel: ActionRiskLevel;
  reversibility: ActionReversibility;
  allowedContexts: AuraBrainContextMode[];
  requiredRole: "any" | "member" | "admin" | "owner" | null;
  /** @deprecated use supportedAutonomyLevels — kept for backward compatibility */
  autonomySupport: AutonomyLevel;
  supportedAutonomyLevels: AutonomyLevel[];
  requiresConfirmation: boolean;
  dailyLimit: number;
  cooldownMs: number;
  timeoutMs: number;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  isFinancial?: boolean;
  isExternalComm?: boolean;
  isDeletion?: boolean;
  isPermissionChange?: boolean;
  /** Final financial posting (not draft) — never AUTO_SAFE */
  isFinancialFinal?: boolean;
  autoSafeEligible?: boolean;
  validate: (input: Record<string, unknown>) => {
    ok: boolean;
    error: string | null;
  };
  prepare?: (
    input: Record<string, unknown>
  ) => Promise<{ ok: boolean; output: Record<string, unknown>; error: string | null }>;
  execute: (ctx: ActionExecuteContext) => Promise<ActionExecuteResult>;
  undo?: (ctx: ActionExecuteContext) => Promise<ActionExecuteResult>;
  sanitizeForAudit?: (
    input: Record<string, unknown>
  ) => Record<string, unknown>;
};

export type ActionExecuteContext = {
  userId: string;
  workspaceId: string | null;
  context: AuraBrainContextMode;
  input: Record<string, unknown>;
  confirmed: boolean;
  adapters?: ActionAdapters;
};

export type ActionAdapters = {
  createNotification?: (payload: {
    title: string;
    message: string;
    type: string;
    related_module?: string | null;
    related_id?: string | null;
  }) => Promise<{ id: string | null; error: string | null }>;
  findUnreadNotification?: (params: {
    type: string;
    related_id: string;
  }) => Promise<boolean>;
  archiveNotification?: (id: string) => Promise<{ ok: boolean; error: string | null }>;
};

export type ActionExecuteResult = {
  ok: boolean;
  output: Record<string, unknown>;
  error: string | null;
  undoToken?: string | null;
};
