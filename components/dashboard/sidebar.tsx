"use client";

import Link from "next/link";
import { ContextSwitcher } from "@/components/dashboard/context-switcher";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { useAuraContext } from "@/components/dashboard/aura-context-provider";

export function Sidebar() {
  const { activeContext, activeWorkspaceId, workspaces } = useAuraContext();
  const subtitle =
    activeContext === "workspace"
      ? workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? "Workspace"
      : "OS pessoal";

  return (
    <aside className="hidden w-[12.8rem] shrink-0 flex-col border-r border-white/[0.06] bg-zinc-950/40 md:flex">
      <div className="flex h-12 flex-col justify-center px-3">
        <Link
          href="/dashboard"
          className="text-[13px] font-semibold tracking-tight text-zinc-200 transition-colors duration-200 hover:text-white"
        >
          Aura Brain
        </Link>
        <p className="text-[10px] text-zinc-600">{subtitle}</p>
      </div>
      <div className="border-b border-white/[0.06] px-2 pb-3">
        <ContextSwitcher
          activeContext={activeContext}
          activeWorkspaceId={activeWorkspaceId}
          workspaces={workspaces}
        />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-2 pb-3 pt-2">
        <DashboardNav />
      </div>
    </aside>
  );
}
