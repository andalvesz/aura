"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, HOME_NAV, isModuleActive } from "@/lib/modules";
import { cn } from "@/utils/cn";

export function Sidebar() {
  const pathname = usePathname();
  const HomeIcon = HOME_NAV.icon;

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
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
        <Link
          href={HOME_NAV.href}
          className={cn(
            "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-[color,background-color] duration-200 ease-out",
            isModuleActive(pathname, HOME_NAV.href)
              ? "bg-white/[0.06] text-zinc-100"
              : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
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
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-[color,background-color] duration-200 ease-out",
                active
                  ? "bg-white/[0.06] text-zinc-100"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
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
    </aside>
  );
}
