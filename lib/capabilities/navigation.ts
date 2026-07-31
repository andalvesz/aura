/**
 * Dynamic navigation — filter OS_NAV by capabilities, skills, flags, roles.
 * Core remains accessible. Disabled modules hidden. URLs preserved.
 */

import {
  OS_NAV,
  type OsNavLink,
  type OsNavSection,
} from "@/lib/modules";
import { isCapabilityEffectivelyEnabled } from "@/lib/capabilities/resolver";
import { ensurePlatformRegistries, listCapabilities } from "@/lib/capabilities/registry";
import type { PlatformState } from "@/lib/capabilities/types";
import type { ResolveContext } from "@/lib/capabilities/types";
import { getPlatformState } from "@/lib/capabilities/store";

/** Map nav item / module ids to capability ids. */
export const NAV_CAPABILITY_MAP: Record<string, string> = {
  financeiro: "module.financeiro",
  saude: "module.saude",
  idiomas: "module.idiomas",
  viagens: "module.viagens",
  knowledge: "module.knowledge",
  "knowledge-hub": "module.knowledge",
  projects: "module.projects",
  business: "module.business",
  "expert-brain": "module.expert-brain",
  "expert-brain-queue": "module.expert-brain",
  scenarios: "module.scenarios",
  priorities: "module.prioritization",
  recommendations: "module.recommendations",
  automations: "module.automations",
  agents: "module.agents",
  learning: "module.learning",
  missions: "module.missions",
  calendario: "module.calendario",
  creator: "module.creator",
  alvesz: "workspace.alvesz",
  skills: "module.platform-skills",
  "capabilities-settings": "module.platform-skills",
};

const CORE_ALWAYS_VISIBLE = new Set([
  "dashboard",
  "aura-home",
  "brain-chat",
  "inbox",
  "feed",
  "favorites",
  "discovery",
  "memoria",
  "aura-settings",
  "settings-hub",
  "perfil",
  "workspace",
  "notificacoes",
  "plans",
  "decisions",
]);

export function capabilityIdForNavItem(itemId: string): string | null {
  return NAV_CAPABILITY_MAP[itemId] ?? null;
}

function linkVisible(
  link: OsNavLink,
  state: PlatformState,
  ctx: ResolveContext
): boolean {
  if (CORE_ALWAYS_VISIBLE.has(link.id)) return true;
  if (link.id === "alvesz" || link.href === "/dashboard/alvesz") {
    return isCapabilityEffectivelyEnabled(state, "workspace.alvesz", ctx);
  }
  if (link.id.includes("consorcio") || link.href.includes("consorcio")) return false;

  const capId = capabilityIdForNavItem(link.id);
  if (!capId) return true;
  return isCapabilityEffectivelyEnabled(state, capId, ctx);
}

function filterLink(
  link: OsNavLink,
  state: PlatformState,
  ctx: ResolveContext
): OsNavLink | null {
  if (!linkVisible(link, state, ctx)) return null;
  const children = (link.children ?? [])
    .map((c) => filterLink(c, state, ctx))
    .filter((c): c is OsNavLink => c != null);
  return { ...link, children: children.length ? children : link.children };
}

export type NavBuildOptions = {
  activeContext?: "personal" | "workspace";
  hasWorkspace?: boolean;
};

export function buildDynamicNavigation(
  ctx: ResolveContext,
  state: PlatformState = getPlatformState(),
  base: OsNavSection[] = OS_NAV,
  opts: NavBuildOptions = {}
): OsNavSection[] {
  ensurePlatformRegistries();
  const order = state.navigationOrderByUser[ctx.userId];

  let sections = base
    .map((section) => {
      if (section.id === "alvesz") {
        const alveszOk = isCapabilityEffectivelyEnabled(
          state,
          "workspace.alvesz",
          ctx
        );
        if (!alveszOk) return null;
        if (opts.activeContext === "personal") return null;
        if (opts.hasWorkspace === false) return null;
        return section;
      }
      if (section.id === "vida" && opts.activeContext === "workspace") {
        return null;
      }
      if (!section.items?.length) return section;
      const items = section.items
        .map((item) => filterLink(item, state, ctx))
        .filter((i): i is OsNavLink => i != null);
      if (!items.length && !section.href) return null;
      return { ...section, items };
    })
    .filter((s): s is OsNavSection => s != null);

  sections = sections.map((section) => {
    if (section.id !== "aura") return section;
    const hasSkills = (section.items ?? []).some((i) => i.id === "skills");
    if (hasSkills) return section;
    return {
      ...section,
      items: [
        ...(section.items ?? []),
        {
          id: "skills",
          href: "/dashboard/skills",
          label: "Skills",
          icon: section.icon,
          accent: "text-cyan-300",
        },
      ],
    };
  });

  // Inject capabilities settings into configuracoes
  sections = sections.map((section) => {
    if (section.id !== "configuracoes") return section;
    const has = (section.items ?? []).some((i) => i.id === "capabilities-settings");
    if (has) return section;
    return {
      ...section,
      items: [
        ...(section.items ?? []),
        {
          id: "capabilities-settings",
          href: "/dashboard/settings/capabilities",
          label: "Capabilities",
          icon: section.icon,
          accent: "text-zinc-300",
        },
      ],
    };
  });

  if (order?.length) {
    sections = sections.map((section) => {
      if (!section.items) return section;
      const rank = (id: string) => {
        const i = order.indexOf(id);
        return i === -1 ? 999 : i;
      };
      return {
        ...section,
        items: [...section.items].sort((a, b) => rank(a.id) - rank(b.id)),
      };
    });
  }

  return sections;
}

export function setNavigationOrderPure(
  state: PlatformState,
  userId: string,
  order: string[]
): PlatformState {
  return {
    ...state,
    navigationOrderByUser: {
      ...state.navigationOrderByUser,
      [userId]: order.slice(0, 200),
    },
  };
}

export function enabledModuleIds(
  state: PlatformState,
  ctx: ResolveContext
): string[] {
  ensurePlatformRegistries();
  const ids: string[] = [];
  for (const def of listCapabilities()) {
    if (!def.moduleIds?.length) continue;
    if (!isCapabilityEffectivelyEnabled(state, def.id, ctx)) continue;
    ids.push(...def.moduleIds);
  }
  return ids;
}
