/**
 * Lifecycle helpers — DRAFT → BETA → STABLE → DEPRECATED → DISABLED → REMOVED.
 */

import type {
  CapabilityDefinition,
  CapabilityLifecycleStatus,
  CapabilityVersionState,
} from "@/lib/capabilities/types";
import { compareSemver } from "@/lib/capabilities/registry";

const ORDER: CapabilityLifecycleStatus[] = [
  "DRAFT",
  "BETA",
  "STABLE",
  "DEPRECATED",
  "DISABLED",
  "REMOVED",
];

export function lifecycleIndex(status: CapabilityLifecycleStatus): number {
  return ORDER.indexOf(status);
}

export function isUsableLifecycle(status: CapabilityLifecycleStatus): boolean {
  return status === "DRAFT" || status === "BETA" || status === "STABLE" || status === "DEPRECATED";
}

export function deprecationWarning(def: CapabilityDefinition): string | null {
  if (def.status !== "DEPRECATED") return null;
  const repl = def.replaces?.length
    ? ` Substitua por: ${def.replaces.join(", ")}.`
    : def.deprecatedMessage
      ? ` ${def.deprecatedMessage}`
      : "";
  return `Capacidade ${def.name} está deprecated.${repl}`;
}

export function resolveVersionState(
  def: CapabilityDefinition,
  installedVersion: string | null
): CapabilityVersionState {
  const available = def.version;
  const updateAvailable =
    installedVersion != null && compareSemver(installedVersion, available) < 0;
  const incompatible =
    installedVersion != null && compareSemver(installedVersion, available) > 0;
  return {
    installedVersion,
    availableVersion: available,
    migrationRequired: def.requiredMigrations.length > 0 && updateAvailable,
    updateAvailable,
    incompatible,
    deprecated: def.status === "DEPRECATED",
  };
}

export function noopLifecycleHooks(def: CapabilityDefinition): {
  install: () => void;
  uninstall: () => void;
  enable: () => void;
  disable: () => void;
  validate: () => boolean;
} {
  return {
    install: () => undefined,
    uninstall: () => {
      if (def.core) throw new Error("Cannot uninstall core");
    },
    enable: () => undefined,
    disable: () => {
      if (def.core) throw new Error("Cannot disable core completely");
    },
    validate: () => isUsableLifecycle(def.status),
  };
}
