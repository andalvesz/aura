"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME_NAV, MODULES, isModuleActive } from "@/lib/modules";
import { cn } from "@/utils/cn";

export function MobileNav() {
  const pathname = usePathname();
  const items = [
    { id: "home", href: HOME_NAV.href, label: HOME_NAV.label, icon: HOME_NAV.icon },
    ...MODULES.map((m) => ({
      id: m.id,
      href: m.href,
      label: m.shortLabel,
      icon: m.icon,
    })),
  ];

  return (
    <nav
      aria-label="Módulos"
      className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-white/[0.06] bg-zinc-950/90 px-2 py-2 backdrop-blur-md md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active = isModuleActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors duration-200",
              active
                ? "bg-white/[0.08] text-zinc-100"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
