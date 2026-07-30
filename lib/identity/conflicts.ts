/**
 * Basic incompatible-claim detection — never silently pick a winner.
 */

import type {
  IdentityClaim,
  IdentityConflict,
  IdentityContextScope,
} from "@/lib/identity/types";

function normalizeValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return JSON.stringify([...v].map(String).sort());
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function valuesCompatible(a: unknown, b: unknown): boolean {
  return normalizeValue(a) === normalizeValue(b);
}

/**
 * Same category+key+context with different values among active claims → conflict.
 */
export function detectIdentityConflicts(
  claims: IdentityClaim[]
): IdentityConflict[] {
  const active = claims.filter(
    (c) =>
      c.status !== "REJECTED" &&
      c.status !== "ARCHIVED" &&
      c.status !== "UNKNOWN"
  );

  const groups = new Map<string, IdentityClaim[]>();
  for (const c of active) {
    const gk = `${c.category}::${c.key}::${c.contextScope}`;
    const list = groups.get(gk) ?? [];
    list.push(c);
    groups.set(gk, list);
  }

  const conflicts: IdentityConflict[] = [];
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const distinct = new Map<string, IdentityClaim>();
    for (const c of list) {
      distinct.set(normalizeValue(c.value), c);
    }
    if (distinct.size < 2) continue;

    const claimIds = list.map((c) => c.id);
    conflicts.push({
      id: `conflict-${list[0].category}-${list[0].key}-${list[0].contextScope}`,
      category: list[0].category,
      key: list[0].key,
      contextScope: list[0].contextScope as IdentityContextScope,
      claimIds,
      values: list.map((c) => c.value),
      explanation: `Afirmações incompatíveis para "${list[0].label || list[0].key}" no contexto ${list[0].contextScope}. O Aura não escolhe automaticamente — confirme, corrija ou separe por contexto.`,
    });
  }

  return conflicts;
}

export function markConflictGroups(
  claims: IdentityClaim[],
  conflicts: IdentityConflict[]
): IdentityClaim[] {
  const claimToGroup = new Map<string, string>();
  for (const conf of conflicts) {
    for (const id of conf.claimIds) {
      claimToGroup.set(id, conf.id);
    }
  }
  return claims.map((c) => {
    const gid = claimToGroup.get(c.id) ?? null;
    if (c.conflictGroupId === gid) return c;
    return { ...c, conflictGroupId: gid, updatedAt: new Date().toISOString() };
  });
}

export function wouldConflictWith(
  existing: IdentityClaim[],
  candidate: Pick<
    IdentityClaim,
    "category" | "key" | "value" | "contextScope" | "id"
  >
): IdentityClaim | null {
  return (
    existing.find(
      (c) =>
        c.id !== candidate.id &&
        c.category === candidate.category &&
        c.key === candidate.key &&
        c.contextScope === candidate.contextScope &&
        c.status !== "REJECTED" &&
        c.status !== "ARCHIVED" &&
        !valuesCompatible(c.value, candidate.value)
    ) ?? null
  );
}
