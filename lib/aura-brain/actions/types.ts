/**
 * Action Registry — types for Aura Brain actions.
 */

import type {
  ActionRiskLevel,
  AutonomyLevel,
  AuraBrainContextMode,
} from "@/lib/aura-brain/types";

export type ActionReversibility = "none" | "soft" | "hard";

export type AuraBrainActionDefinition = {
  id: string;
  name: string;
  module: string;
  description: string;
  riskLevel: ActionRiskLevel;
  reversibility: ActionReversibility;
  allowedContexts: AuraBrainContextMode[];
  requiredRole: "any" | "member" | "admin" | "owner" | null;
  autonomySupport: AutonomyLevel;
  isFinancial?: boolean;
  isExternalComm?: boolean;
  isDeletion?: boolean;
  validate: (input: Record<string, unknown>) => {
    ok: boolean;
    error: string | null;
  };
  execute: (ctx: ActionExecuteContext) => Promise<ActionExecuteResult>;
  undo?: (ctx: ActionExecuteContext) => Promise<ActionExecuteResult>;
};

export type ActionExecuteContext = {
  userId: string;
  workspaceId: string | null;
  context: AuraBrainContextMode;
  input: Record<string, unknown>;
  confirmed: boolean;
  /** Injected adapters — keep pure registry testable */
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
};

export type ActionExecuteResult = {
  ok: boolean;
  output: Record<string, unknown>;
  error: string | null;
  undoToken?: string | null;
};
