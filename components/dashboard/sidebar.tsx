"use client";

import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export function Sidebar() {
  return (
    <aside className="hidden w-[12.8rem] shrink-0 flex-col border-r border-white/[0.06] bg-zinc-950/40 md:flex">
      <div className="flex h-12 flex-col justify-center px-3">
        <Link
          href="/dashboard"
          className="text-[13px] font-semibold tracking-tight text-zinc-200 transition-colors duration-200 hover:text-white"
        >
          Aura
        </Link>
        <p className="text-[10px] text-zinc-600">OS pessoal · Anderson Alves</p>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-2 pb-3">
        <DashboardNav />
      </div>
    </aside>
  );
}
