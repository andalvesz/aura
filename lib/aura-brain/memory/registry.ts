/**
 * Memory provider registry — enforces user/workspace isolation.
 */

import type {
  MemoryProvider,
  MemoryRecord,
  MemoryScope,
} from "@/lib/aura-brain/memory/types";

const providers = new Map<string, MemoryProvider>();

export function registerMemoryProvider(p: MemoryProvider): void {
  providers.set(p.id, p);
}

export function listMemoryProviders(): MemoryProvider[] {
  return [...providers.values()];
}

export async function collectMemories(
  scope: MemoryScope,
  limit = 20
): Promise<MemoryRecord[]> {
  const out: MemoryRecord[] = [];
  for (const p of providers.values()) {
    const rows = await p.list(scope, limit);
    // Isolation guard
    for (const r of rows) {
      if (r.meta?.userId && r.meta.userId !== scope.userId) continue;
      if (
        scope.workspaceId &&
        r.meta?.workspaceId &&
        r.meta.workspaceId !== scope.workspaceId
      ) {
        continue;
      }
      out.push(r);
    }
  }
  return out.slice(0, limit);
}
