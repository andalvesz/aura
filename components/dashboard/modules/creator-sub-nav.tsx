"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

const TABS = [
  { href: "/dashboard/creator", label: "Creator" },
  { href: "/dashboard/creator/research", label: "Market Research" },
  { href: "/dashboard/creator/copy", label: "CopyLab" },
  { href: "/dashboard/creator/factory", label: "Product Factory" },
  { href: "/dashboard/creator/studio", label: "Creative Studio" },
  { href: "/dashboard/creator/landing", label: "Landing Builder" },
  { href: "/dashboard/creator/ads", label: "Ads Manager" },
  { href: "/dashboard/creator/meta", label: "Meta Connect" },
  { href: "/dashboard/creator/autopilot", label: "Autopilot" },
  { href: "/dashboard/creator/orchestrator", label: "Orchestrator" },
  { href: "/dashboard/creator/launch", label: "Launch Center" },
] as const;

export function CreatorSubNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
      {TABS.map((tab) => {
        const active =
          tab.href === "/dashboard/creator"
            ? pathname === "/dashboard/creator"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors",
              active
                ? "bg-violet-500/20 text-violet-200"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
