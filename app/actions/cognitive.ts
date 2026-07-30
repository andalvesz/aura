"use server";

import { revalidatePath } from "next/cache";
import {
  archiveCognitiveArtifact,
  bootstrapCognitiveEngine,
  confirmCognitiveArtifact,
  correctCognitiveArtifact,
  deleteCognitiveArtifact,
  generateCognitiveArtifacts,
  rejectCognitiveArtifact,
  submitCognitiveFeedback,
  suppressSimilarArtifacts,
} from "@/lib/supabase/services/cognitive-engine.service";
import type { FeedbackKind } from "@/lib/cognitive/types";

function revalidateCognitive(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/insights");
  revalidatePath("/dashboard/settings/aura-brain");
}

export async function confirmCognitiveArtifactAction(
  id: string
): Promise<{ error: string | null }> {
  if (!id) return { error: "id obrigatório" };
  const res = await confirmCognitiveArtifact(id);
  revalidateCognitive();
  return { error: res.error };
}

export async function rejectCognitiveArtifactAction(
  id: string,
  reason?: string
): Promise<{ error: string | null }> {
  if (!id) return { error: "id obrigatório" };
  const res = await rejectCognitiveArtifact(id, reason);
  revalidateCognitive();
  return { error: res.error };
}

export async function correctCognitiveArtifactAction(input: {
  artifactId: string;
  title?: string;
  summary?: string;
}): Promise<{ error: string | null }> {
  if (!input.artifactId) return { error: "id obrigatório" };
  const res = await correctCognitiveArtifact(input.artifactId, {
    title: input.title,
    summary: input.summary,
  });
  revalidateCognitive();
  return { error: res.error };
}

export async function archiveCognitiveArtifactAction(
  id: string
): Promise<{ error: string | null }> {
  if (!id) return { error: "id obrigatório" };
  const res = await archiveCognitiveArtifact(id);
  revalidateCognitive();
  return { error: res.error };
}

export async function deleteCognitiveArtifactAction(
  id: string
): Promise<{ error: string | null }> {
  if (!id) return { error: "id obrigatório" };
  const res = await deleteCognitiveArtifact(id);
  revalidateCognitive();
  return { error: res.error };
}

export async function submitCognitiveFeedbackAction(input: {
  artifactId: string;
  kind: FeedbackKind;
  note?: string;
}): Promise<{ error: string | null }> {
  if (!input.artifactId || !input.kind) return { error: "Parâmetros inválidos" };
  const res = await submitCognitiveFeedback(
    input.artifactId,
    input.kind,
    input.note
  );
  revalidateCognitive();
  return { error: res.error };
}

export async function suppressSimilarCognitiveAction(
  id: string,
  reason?: string
): Promise<{ error: string | null }> {
  if (!id) return { error: "id obrigatório" };
  const res = await suppressSimilarArtifacts(id, reason);
  revalidateCognitive();
  return { error: res.error };
}

export async function bootstrapCognitiveEngineAction(): Promise<{
  error: string | null;
  generated?: number;
}> {
  const res = await bootstrapCognitiveEngine({ maxItems: 24 });
  revalidateCognitive();
  return {
    error: res.error,
    generated: res.report.artifactsGenerated,
  };
}

export async function generateCognitiveArtifactsAction(): Promise<{
  error: string | null;
  generated?: number;
}> {
  const res = await generateCognitiveArtifacts({ maxArtifacts: 24 });
  revalidateCognitive();
  return {
    error: res.error,
    generated: res.artifacts.length,
  };
}
