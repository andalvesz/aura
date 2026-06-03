"use client";

import { createContext, useContext } from "react";

type DashboardUserContextValue = {
  displayName: string;
};

const DashboardUserContext = createContext<DashboardUserContextValue>({
  displayName: "você",
});

export function DashboardUserProvider({
  displayName,
  children,
}: {
  displayName: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardUserContext.Provider value={{ displayName }}>
      {children}
    </DashboardUserContext.Provider>
  );
}

export function useDashboardUser() {
  return useContext(DashboardUserContext);
}

export function resolveDashboardDisplayName(
  fullName?: string | null,
  email?: string | null
): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const first = trimmed.split(/\s+/)[0];
    return first || trimmed;
  }
  const fromEmail = email?.split("@")[0]?.trim();
  return fromEmail || "você";
}
