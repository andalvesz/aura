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
