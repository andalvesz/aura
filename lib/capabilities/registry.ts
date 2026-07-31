/**
 * Capability + Skill registries — code-registered only.
 */

import { BUILTIN_CAPABILITIES, EXCLUDED_CAPABILITY_IDS } from "@/lib/capabilities/catalog";
import { BUILTIN_SKILLS } from "@/lib/capabilities/skills-catalog";
import type { CapabilityDefinition, SkillDefinition } from "@/lib/capabilities/types";

const capabilityRegistry = new Map<string, CapabilityDefinition>();
const skillRegistry = new Map<string, SkillDefinition>();
let capabilitiesReady = false;
let skillsReady = false;

export function registerCapability(def: CapabilityDefinition): void {
  if ((EXCLUDED_CAPABILITY_IDS as readonly string[]).includes(def.id)) {
    throw new Error(`Capability excluded: ${def.id}`);
  }
  if (def.id.includes("consorcio")) {
    throw new Error("Consórcios capability is not allowed");
  }
  capabilityRegistry.set(def.id, def);
}

export function registerSkill(def: SkillDefinition): void {
  if (def.id.includes("consorcio") || def.slug.includes("consorcio")) {
    throw new Error("Consórcios skill is not allowed");
  }
  skillRegistry.set(def.id, def);
}

export function clearCapabilityRegistry(): void {
  capabilityRegistry.clear();
  capabilitiesReady = false;
}

export function clearSkillRegistry(): void {
  skillRegistry.clear();
  skillsReady = false;
}

export function getCapability(id: string): CapabilityDefinition | undefined {
  ensureBuiltinCapabilities();
  return capabilityRegistry.get(id);
}

export function getSkill(id: string): SkillDefinition | undefined {
  ensureBuiltinSkills();
  return skillRegistry.get(id);
}

export function getSkillBySlug(slug: string): SkillDefinition | undefined {
  ensureBuiltinSkills();
  return [...skillRegistry.values()].find((s) => s.slug === slug);
}

export function listCapabilities(): CapabilityDefinition[] {
  ensureBuiltinCapabilities();
  return [...capabilityRegistry.values()];
}

export function listSkills(): SkillDefinition[] {
  ensureBuiltinSkills();
  return [...skillRegistry.values()];
}

export function listCoreCapabilities(): CapabilityDefinition[] {
  return listCapabilities().filter((c) => c.core);
}

export function listOptionalCapabilities(): CapabilityDefinition[] {
  return listCapabilities().filter((c) => !c.core);
}

export function listPublicSkills(opts?: {
  includePrivate?: boolean;
  workspaceSlug?: string | null;
}): SkillDefinition[] {
  return listSkills().filter((s) => {
    if (s.privateWorkspace) {
      if (!opts?.includePrivate) return false;
      const slug = opts.workspaceSlug ?? null;
      if (!slug || !s.allowedWorkspaceSlugs?.includes(slug)) return false;
    }
    if (s.visibility === "FUTURE_PUBLIC") return false;
    return true;
  });
}

export function isCapabilityRegistered(id: string): boolean {
  ensureBuiltinCapabilities();
  return capabilityRegistry.has(id);
}

export function isSkillRegistered(id: string): boolean {
  ensureBuiltinSkills();
  return skillRegistry.has(id);
}

export function ensureBuiltinCapabilities(): void {
  if (capabilitiesReady) return;
  for (const def of BUILTIN_CAPABILITIES) {
    capabilityRegistry.set(def.id, def);
  }
  capabilitiesReady = true;
}

export function ensureBuiltinSkills(): void {
  if (skillsReady) return;
  for (const def of BUILTIN_SKILLS) {
    skillRegistry.set(def.id, def);
  }
  skillsReady = true;
}

export function ensurePlatformRegistries(): void {
  ensureBuiltinCapabilities();
  ensureBuiltinSkills();
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}
