"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { AuraActiveContext, WorkspaceRole } from "@/types/database";
import type { ContextWorkspaceOption } from "@/components/dashboard/context-switcher";

export type AuraContextValue = {
  activeContext: AuraActiveContext;
  activeWorkspaceId: string | null;
  workspaceRole: WorkspaceRole | null;
  workspaces: ContextWorkspaceOption[];
};

const AuraContext = createContext<AuraContextValue | null>(null);

export function AuraContextProvider({
  value,
  children,
}: {
  value: AuraContextValue;
  children: ReactNode;
}) {
  const memo = useMemo(() => value, [value]);
  return <AuraContext.Provider value={memo}>{children}</AuraContext.Provider>;
}

export function useAuraContext(): AuraContextValue {
  const ctx = useContext(AuraContext);
  if (!ctx) {
    return {
      activeContext: "personal",
      activeWorkspaceId: null,
      workspaceRole: null,
      workspaces: [],
    };
  }
  return ctx;
}
