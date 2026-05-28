import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { AvatarStack } from "@/components/dashboard/avatar-stack";

type DashboardHeaderProps = {
  email: string;
  fullName?: string | null;
};

export function DashboardHeader({ email, fullName }: DashboardHeaderProps) {
  const displayName = fullName || email.split("@")[0];

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
      <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2 md:flex-none">
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
          {displayName.charAt(0).toUpperCase()}
        </div>
        <form action={logout} className="shrink-0">
          <button
            type="submit"
            className="h-8 rounded-md border border-white/[0.08] px-2 text-[11px] text-zinc-400 transition-colors duration-200 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-zinc-200 sm:px-2.5 sm:text-[12px]"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
