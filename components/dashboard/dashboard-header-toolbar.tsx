"use client";

import { Bell } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { AvatarStack } from "@/components/dashboard/avatar-stack";
import { OfflineBadge } from "@/components/dashboard/offline-badge";
import { ResetTestDataButton } from "@/components/dashboard/reset-test-data-button";

type DashboardHeaderToolbarProps = {
  email: string;
  displayName: string;
  showResetTestData?: boolean;
};

export function DashboardHeaderToolbar({
  email,
  displayName,
  showResetTestData = false,
}: DashboardHeaderToolbarProps) {
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2 md:flex-none">
      <OfflineBadge />
      <AvatarStack max={3} size="sm" className="hidden lg:flex" />
      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors duration-200 hover:bg-white/[0.04] hover:text-zinc-300"
        aria-label="Notificações"
      >
        <Bell className="size-3.5" />
      </button>
      <div className="hidden min-w-0 text-right sm:block">
        <p className="truncate text-[12px] font-medium leading-tight text-zinc-200">
          {displayName}
        </p>
        <p className="truncate text-[10px] text-zinc-600">{email}</p>
      </div>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/90 to-violet-600/90 text-[11px] font-medium text-white">
        {initial}
      </div>
      <ResetTestDataButton visible={showResetTestData} />
      <form action={logout} className="shrink-0">
        <button
          type="submit"
          className="h-8 rounded-md border border-white/[0.08] px-2 text-[11px] text-zinc-400 transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-zinc-200 sm:px-2.5 sm:text-[12px]"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
