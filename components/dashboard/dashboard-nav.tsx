"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, HOME_NAV, MEMORY_NAV, isModuleActive } from "@/lib/modules";
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
