"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { GlobalSearch } from "@/components/dashboard/global-search";
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
    <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-zinc-950/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md max-md:flex-wrap md:h-11 md:min-h-0 md:gap-3 md:px-4 md:pt-0">
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
      <div className="order-3 w-full min-w-0 basis-full md:order-none md:max-w-md md:flex-1 md:basis-auto">
        <GlobalSearch />
      </div>
      <DashboardHeaderToolbar
        email={email}
        displayName={displayName}
        showResetTestData={showResetTestData}
      />
    </header>
  );
}
