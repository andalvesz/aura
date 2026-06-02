import Link from "next/link";
import { Search } from "lucide-react";
import { DashboardHeaderToolbar } from "@/components/dashboard/dashboard-header-toolbar";

type DashboardHeaderProps = {
  email: string;
  fullName?: string | null;
  showResetTestData?: boolean;
};

export function DashboardHeader({
  email,
  fullName,
  showResetTestData = false,
}: DashboardHeaderProps) {
  const displayName = fullName?.trim() || email.split("@")[0] || "Usuário";

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-3 md:gap-3 md:px-4">
      <Link
        href="/dashboard"
        className="text-[13px] font-semibold tracking-tight text-zinc-300 transition-colors hover:text-white md:hidden"
      >
        Aura
      </Link>
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
