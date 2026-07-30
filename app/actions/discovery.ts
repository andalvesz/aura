"use server";

import { revalidatePath } from "next/cache";
import {
  archiveDiscovery,
  bootstrapDiscoveryEngine,
  confirmDiscovery,
  generateDiscoveries,
  rejectDiscovery,
  submitDiscoveryFeedback,
  suppressSimilarDiscoveries,
} from "@/lib/supabase/services/discovery-engine.service";
import type { FeedbackKind } from "@/lib/discovery/types";

function revalidateDiscovery(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/discovery");
  revalidatePath("/dashboard/settings/aura-brain");
  revalidatePath("/dashboard/settings/memory");
}

export async function confirmDiscoveryAction(
  id: string,
  expectedVersion?: number
): Promise<{ error: string | null; conflict?: boolean }> {
  if (!id) return { error: "id obrigatório" };
  const res = await confirmDiscovery(id, expectedVersion);
  revalidateDiscovery();
  return { error: res.error, conflict: res.conflict };
}

export async function rejectDiscoveryAction(
  id: string,
  reason?: string,
  expectedVersion?: number
): Promise<{ error: string | null; conflict?: boolean }> {
  if (!id) return { error: "id obrigatório" };
  const res = await rejectDiscovery(id, reason, expectedVersion);
  revalidateDiscovery();
  return { error: res.error, conflict: res.conflict };
}

export async function archiveDiscoveryAction(
  id: string,
  expectedVersion?: number
): Promise<{ error: string | null; conflict?: boolean }> {
  if (!id) return { error: "id obrigatório" };
  const res = await archiveDiscovery(id, expectedVersion);
  revalidateDiscovery();
  return { error: res.error, conflict: res.conflict };
}

export async function suppressSimilarDiscoveryAction(
  id: string,
  reason?: string,
  expectedVersion?: number
): Promise<{ error: string | null; conflict?: boolean }> {
  if (!id) return { error: "id obrigatório" };
  const res = await suppressSimilarDiscoveries(id, reason, expectedVersion);
  revalidateDiscovery();
  return { error: res.error, conflict: res.conflict };
}

export async function submitDiscoveryFeedbackAction(input: {
  artifactId: string;
  kind: FeedbackKind;
  note?: string;
  expectedVersion?: number;
}): Promise<{ error: string | null; conflict?: boolean }> {
  if (!input.artifactId || !input.kind) return { error: "Parâmetros inválidos" };
  const res = await submitDiscoveryFeedback(
    input.artifactId,
    input.kind,
    input.note,
    input.expectedVersion
  );
  revalidateDiscovery();
  return { error: res.error, conflict: res.conflict };
}

export async function bootstrapDiscoveryEngineAction(): Promise<{
  error: string | null;
  generated?: number;
  outcome?: string;
  message?: string;
  correlationId?: string;
}> {
  const res = await bootstrapDiscoveryEngine({ maxItems: 24 });
  revalidateDiscovery();
  return {
    error: res.error,
    generated: res.report.artifactsGenerated,
    outcome: res.report.outcome,
    message: res.report.message,
    correlationId: res.report.correlationId,
  };
}

export async function generateDiscoveriesAction(): Promise<{
  error: string | null;
  generated?: number;
}> {
  const res = await generateDiscoveries({ maxArtifacts: 24 });
  revalidateDiscovery();
  return {
    error: res.error,
    generated: res.artifacts.length,
  };
}
