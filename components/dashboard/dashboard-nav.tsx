"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BI_NAV,
  DIAGNOSTICS_NAV,
  GOALS_NAV,
  LOGS_NAV,
  MODULES,
  HOME_NAV,
  MEMORY_NAV,
  NOTIFICATIONS_NAV,
  REPORTS_NAV,
  isModuleActive,
} from "@/lib/modules";
import { cn } from "@/utils/cn";

type DashboardNavProps = {
  onNavigate?: () => void;
  className?: string;
  linkClassName?: string;
};

export function DashboardNav({
  onNavigate,
  className,
  linkClassName,
}: DashboardNavProps) {
  const pathname = usePathname();
  const HomeIcon = HOME_NAV.icon;
  const MemoryIcon = MEMORY_NAV.icon;
  const ReportsIcon = REPORTS_NAV.icon;
  const GoalsIcon = GOALS_NAV.icon;
  const BiIcon = BI_NAV.icon;
  const NotificationsIcon = NOTIFICATIONS_NAV.icon;
  const DiagnosticsIcon = DIAGNOSTICS_NAV.icon;
  const LogsIcon = LOGS_NAV.icon;

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      <Link
        href={HOME_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          isModuleActive(pathname, HOME_NAV.href)
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <HomeIcon
          className={cn(
            "size-[15px] shrink-0",
            isModuleActive(pathname, HOME_NAV.href)
              ? "text-zinc-300"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        {HOME_NAV.label}
      </Link>
      <Link
        href={MEMORY_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          isModuleActive(pathname, MEMORY_NAV.href)
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <MemoryIcon
          className={cn(
            "size-[15px] shrink-0",
            isModuleActive(pathname, MEMORY_NAV.href)
              ? "text-violet-400"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        {MEMORY_NAV.label}
      </Link>
      <Link
        href={NOTIFICATIONS_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          isModuleActive(pathname, NOTIFICATIONS_NAV.href)
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <NotificationsIcon
          className={cn(
            "size-[15px] shrink-0",
            isModuleActive(pathname, NOTIFICATIONS_NAV.href)
              ? "text-amber-400"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        {NOTIFICATIONS_NAV.label}
      </Link>
      <Link
        href={REPORTS_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          isModuleActive(pathname, REPORTS_NAV.href)
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <ReportsIcon
          className={cn(
            "size-[15px] shrink-0",
            isModuleActive(pathname, REPORTS_NAV.href)
              ? "text-cyan-400"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        {REPORTS_NAV.label}
      </Link>
      <Link
        href={GOALS_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          isModuleActive(pathname, GOALS_NAV.href)
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <GoalsIcon
          className={cn(
            "size-[15px] shrink-0",
            isModuleActive(pathname, GOALS_NAV.href)
              ? "text-amber-400"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        {GOALS_NAV.label}
      </Link>
      <Link
        href={BI_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          isModuleActive(pathname, BI_NAV.href)
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <BiIcon
          className={cn(
            "size-[15px] shrink-0",
            isModuleActive(pathname, BI_NAV.href)
              ? "text-violet-400"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        {BI_NAV.label}
      </Link>
      <Link
        href={DIAGNOSTICS_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          isModuleActive(pathname, DIAGNOSTICS_NAV.href)
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <DiagnosticsIcon
          className={cn(
            "size-[15px] shrink-0",
            isModuleActive(pathname, DIAGNOSTICS_NAV.href)
              ? "text-teal-400"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        {DIAGNOSTICS_NAV.label}
      </Link>
      <Link
        href={LOGS_NAV.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          isModuleActive(pathname, LOGS_NAV.href)
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <LogsIcon
          className={cn(
            "size-[15px] shrink-0",
            isModuleActive(pathname, LOGS_NAV.href)
              ? "text-orange-400"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        {LOGS_NAV.label}
      </Link>
      <p className="mb-0.5 mt-3 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        Módulos
      </p>
      {MODULES.map((mod) => {
        const active = isModuleActive(pathname, mod.href);
        const Icon = mod.icon;
        return (
          <Link
            key={mod.id}
            href={mod.href}
            onClick={onNavigate}
            className={cn(
              "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
              active
                ? "bg-white/[0.06] text-zinc-100"
                : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
              linkClassName
            )}
          >
            <Icon
              className={cn(
                "size-[15px] shrink-0 transition-colors duration-200",
                active ? mod.accent : "text-zinc-600 group-hover:text-zinc-400"
              )}
            />
            <span className="truncate">{mod.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
