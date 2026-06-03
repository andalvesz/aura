"use client";

import { useState } from "react";
import { DashboardOffline } from "@/components/dashboard/dashboard-offline";
import {
  DashboardUserProvider,
  resolveDashboardDisplayName,
} from "@/components/dashboard/dashboard-user-context";
import { DashboardHeader } from "@/components/dashboard/header";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { Sidebar } from "@/components/dashboard/sidebar";

type DashboardShellProps = {
  children: React.ReactNode;
  email: string;
  fullName: string | null;
  showResetTestData: boolean;
};

export function DashboardShell({
  children,
  email,
  fullName,
  showResetTestData,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const displayName = resolveDashboardDisplayName(fullName, email);

  return (
    <DashboardUserProvider displayName={displayName}>
    <div className="flex min-h-[100dvh]">
      <DashboardOffline />
      <Sidebar />
      <MobileSidebar
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          email={email}
          fullName={fullName}
          showResetTestData={showResetTestData}
          onMenuClick={() => setMobileNavOpen(true)}
          menuOpen={mobileNavOpen}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-4">
          {children}
        </main>
      </div>
    </div>
    </DashboardUserProvider>
  );
}
