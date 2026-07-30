/**
 * Deduplicate plans and proposed actions.
 */

export function buildDedupeKey(
  actionId: string,
  parts: Array<string | number | null | undefined>
): string {
  return [actionId, ...parts.map((p) => String(p ?? ""))].join("::");
}

export function filterNewKeys(
  keys: string[],
  pending: Set<string> | string[]
): string[] {
  const set = pending instanceof Set ? pending : new Set(pending);
  return keys.filter((k) => !set.has(k));
}

export function uniqueByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
