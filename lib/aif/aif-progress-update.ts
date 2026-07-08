import type { ExpertIngestionQueueItem, ExpertIngestionStatus, Json } from "@/types/database";
import { ExpertIngestionQueueRepository } from "@/lib/supabase/repositories/expert-brain.repository";
import { getOptionalDataContext } from "@/lib/supabase/services/context";
import {
  type AifV2QueueMetadata,
  mergeQueueMetadata,
} from "@/lib/aif/aif-progress";

/** Server-only progress writer — do not import from client components */
export async function updateProgress(
  itemId: string,
  patch: {
    status?: ExpertIngestionStatus;
    progress?: number;
    error?: string | null;
    metadata?: AifV2QueueMetadata | Record<string, unknown>;
    mergeMetadata?: boolean;
  }
): Promise<{ data: ExpertIngestionQueueItem | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { data: null, error: "Usuário não autenticado." };

  const repo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const { data: existing, error: loadError } = await repo.findById(itemId);
  if (loadError || !existing) {
    return { data: null, error: loadError ?? "Item da fila não encontrado." };
  }

  const nextMeta =
    patch.metadata !== undefined
      ? patch.mergeMetadata === false
        ? (patch.metadata as Record<string, unknown>)
        : mergeQueueMetadata(existing.metadata, patch.metadata)
      : existing.metadata;

  return repo.update(itemId, {
    ...(patch.status ? { status: patch.status } : {}),
    ...(typeof patch.progress === "number" ? { progress: patch.progress } : {}),
    ...(patch.error !== undefined ? { error: patch.error } : {}),
    metadata: nextMeta as Json,
  });
}
