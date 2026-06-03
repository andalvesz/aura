"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { DashboardHeaderToolbar } from "@/components/dashboard/dashboard-header-toolbar";

type DashboardHeaderProps = {
  email: string;
  fullName?: string | null;
  showResetTestData?: boolean;
  onMenuClick?: () => void;
  menuOpen?: boolean;
};

export function DashboardHeader({
  email,
  fullName,
  showResetTestData = false,
  onMenuClick,
  menuOpen = false,
}: DashboardHeaderProps) {
  const displayName = fullName?.trim() || email.split("@")[0] || "Usuário";

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-zinc-950/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md md:h-11 md:gap-3 md:px-4 md:pt-0">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu de módulos"
          aria-expanded={menuOpen}
          aria-controls="mobile-sidebar"
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
        >
          <Menu className="size-5" />
        </button>
        <Link
          href="/dashboard"
          className="truncate text-[13px] font-semibold tracking-tight text-zinc-300 transition-colors hover:text-white md:hidden"
        >
          Aura
        </Link>
      </div>
      <div className="relative hidden min-w-0 max-w-xs flex-1 md:block">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          type="search"
          placeholder="Buscar..."
          className="h-8 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-8 pr-3 text-[12px] text-zinc-200 placeholder:text-zinc-600 transition-colors duration-200 focus:border-white/[0.12] focus:bg-white/[0.04] focus:outline-none"
        />
      </div>
      <DashboardHeaderToolbar
        email={email}
        displayName={displayName}
        showResetTestData={showResetTestData}
      />
    </header>
  );
}
