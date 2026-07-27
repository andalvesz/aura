"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  OS_NAV,
  isModuleActive,
  type OsNavLink,
  type OsNavSection,
} from "@/lib/modules";
import { cn } from "@/utils/cn";
import { useAuraContext } from "@/components/dashboard/aura-context-provider";

type DashboardNavProps = {
  onNavigate?: () => void;
  className?: string;
  linkClassName?: string;
};

function sectionContainsPath(section: OsNavSection, pathname: string): boolean {
  if (section.href && isModuleActive(pathname, section.href)) return true;
  return (section.items ?? []).some((item) => linkContainsPath(item, pathname));
}

function linkContainsPath(link: OsNavLink, pathname: string): boolean {
  if (isModuleActive(pathname, link.href)) return true;
  return (link.children ?? []).some((child) => isModuleActive(pathname, child.href));
}

function NavLinkRow({
  link,
  pathname,
  onNavigate,
  linkClassName,
  nested = false,
}: {
  link: OsNavLink;
  pathname: string;
  onNavigate?: () => void;
  linkClassName?: string;
  nested?: boolean;
}) {
  const active = isModuleActive(pathname, link.href);
  const Icon = link.icon;
  const hasChildren = Boolean(link.children?.length);
  const childActive = (link.children ?? []).some((c) =>
    isModuleActive(pathname, c.href)
  );
  const [open, setOpen] = useState(active || childActive);

  useEffect(() => {
    if (active || childActive) setOpen(true);
  }, [active, childActive]);

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <Link
          href={link.href}
          onClick={onNavigate}
          className={cn(
            "group flex min-h-11 flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
            nested && "pl-4 md:pl-3",
            active
              ? "bg-white/[0.06] text-zinc-100"
              : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
            linkClassName
          )}
        >
          <Icon
            className={cn(
              "size-[15px] shrink-0 transition-colors duration-200",
              active
                ? link.accent ?? "text-zinc-300"
                : "text-zinc-600 group-hover:text-zinc-400"
            )}
          />
          <span className="truncate">{link.label}</span>
        </Link>
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "Recolher" : "Expandir"}
            onClick={() => setOpen((v) => !v)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-600 hover:bg-white/[0.03] hover:text-zinc-400 md:size-6"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </button>
        ) : null}
      </div>
      {hasChildren && open ? (
        <div className="ml-2 border-l border-white/[0.06] pl-1">
          {link.children!.map((child) => (
            <NavLinkRow
              key={child.id}
              link={child}
              pathname={pathname}
              onNavigate={onNavigate}
              linkClassName={linkClassName}
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavSectionBlock({
  section,
  pathname,
  onNavigate,
  linkClassName,
  defaultOpen,
}: {
  section: OsNavSection;
  pathname: string;
  onNavigate?: () => void;
  linkClassName?: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.icon;
  const sectionActive = Boolean(
    section.href && isModuleActive(pathname, section.href)
  );

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (section.href && !section.items?.length) {
    return (
      <Link
        href={section.href}
        onClick={onNavigate}
        className={cn(
          "group flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-[color,background-color] duration-200 ease-out md:min-h-0 md:px-2 md:py-1.5",
          sectionActive
            ? "bg-white/[0.06] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
          linkClassName
        )}
      >
        <Icon
          className={cn(
            "size-[15px] shrink-0",
            sectionActive
              ? section.accent ?? "text-zinc-300"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />
        <span className="truncate">{section.label}</span>
      </Link>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <Icon className="size-3.5 shrink-0 text-zinc-500" />
        <span className="flex-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          {section.label}
        </span>
        <ChevronDown
          className={cn(
            "size-3 text-zinc-600 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-0.5">
          {(section.items ?? []).map((item) => (
            <NavLinkRow
              key={item.id}
              link={item}
              pathname={pathname}
              onNavigate={onNavigate}
              linkClassName={linkClassName}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DashboardNav({
  onNavigate,
  className,
  linkClassName,
}: DashboardNavProps) {
  const pathname = usePathname();
  const { activeContext, workspaces } = useAuraContext();
  const hasWorkspace = workspaces.length > 0;

  const visibleNav = useMemo(() => {
    return OS_NAV.filter((section) => {
      if (section.id === "alvesz") {
        return activeContext === "workspace" && hasWorkspace;
      }
      if (section.id === "vida") {
        return activeContext === "personal";
      }
      // Negócios / Aura / Configurações remain reachable; workspace focus hides neither
      // except Alvesz exclusive section above.
      return true;
    });
  }, [activeContext, hasWorkspace]);

  const openByPath = useMemo(() => {
    const set = new Set<string>();
    for (const section of visibleNav) {
      if (sectionContainsPath(section, pathname)) set.add(section.id);
    }
    return set;
  }, [pathname, visibleNav]);

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {visibleNav.map((section) => (
        <NavSectionBlock
          key={section.id}
          section={section}
          pathname={pathname}
          onNavigate={onNavigate}
          linkClassName={linkClassName}
          defaultOpen={
            section.id === "dashboard" ||
            section.id === "alvesz" ||
            openByPath.has(section.id)
          }
        />
      ))}
    </nav>
  );
}
