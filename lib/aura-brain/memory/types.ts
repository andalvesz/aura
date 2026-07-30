/**
 * Memory interface — providers only in Sprint 4.
 */

export type MemoryScope = {
  userId: string;
  workspaceId: string | null;
};

export type MemoryRecord = {
  id: string;
  kind: string;
  title: string;
  content: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

export interface MemoryProvider {
  id: string;
  list(scope: MemoryScope, limit?: number): Promise<MemoryRecord[]>;
}

export type { MemoryScope as AuraBrainMemoryScope };
