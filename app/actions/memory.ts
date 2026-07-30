"use server";

import { revalidatePath } from "next/cache";
import {
  archiveMemory,
  correctMemory,
  createMemory,
  deleteMemory,
  disputeMemory,
  promoteMemory,
  submitMemoryFeedback,
} from "@/lib/supabase/services/memory-engine.service";
import type { CreateMemoryInput, MemoryType } from "@/lib/memory/types";

function revalidateMemory(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/memory");
  revalidatePath("/dashboard/settings/aura-brain");
  revalidatePath("/dashboard/settings/identity");
}

export async function createManualMemoryAction(input: {
  kind: "fato" | "acontecimento" | "procedimento" | "correcao" | "nota";
  title: string;
  content: string;
  context?: string;
  retentionPolicy?: CreateMemoryInput["retentionPolicy"];
  sensitivity?: CreateMemoryInput["sensitivity"];
}): Promise<{ error: string | null; memoryId?: string }> {
  if (!input.title?.trim() || !input.content?.trim()) {
    return { error: "Título e conteúdo obrigatórios" };
  }

  const typeMap: Record<typeof input.kind, MemoryType> = {
    fato: "SEMANTIC",
    acontecimento: "EPISODIC",
    procedimento: "PROCEDURAL",
    correcao: "SEMANTIC",
    nota: "SEMANTIC",
  };
  const memoryType = typeMap[input.kind];

  const structuredContent: CreateMemoryInput["structuredContent"] =
    memoryType === "EPISODIC"
      ? {
          kind: "episodic",
          when: new Date().toISOString(),
          summary: input.content,
        }
      : memoryType === "PROCEDURAL"
        ? {
            kind: "procedural",
            processKey: input.title.toLowerCase().replace(/\s+/g, "_").slice(0, 64),
            version: 1,
            steps: input.content
              .split(/\n|;/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((instruction, i) => ({ order: i + 1, instruction })),
            validationStatus: "user_approved",
            summary: input.content,
          }
        : {
            kind: "semantic",
            factKey: input.title.toLowerCase().replace(/\s+/g, "_").slice(0, 64),
            factValue: input.content,
            summary: input.content,
          };

  const res = await createMemory({
    memoryType,
    title: input.title.trim(),
    content: input.content.trim(),
    structuredContent,
    sourceType: "manual_entry",
    context: input.context?.trim() || "manual",
    confirmNow: true,
    retentionPolicy: input.retentionPolicy ?? "user_managed",
    sensitivity: input.sensitivity ?? "STANDARD",
    semanticKey:
      structuredContent.kind === "semantic" ? structuredContent.factKey : undefined,
    evidenceSummary: "Entrada manual confirmada pelo usuário",
  });

  revalidateMemory();
  return { error: res.error, memoryId: res.memory?.id };
}

export async function confirmMemoryAction(
  memoryId: string
): Promise<{ error: string | null }> {
  if (!memoryId) return { error: "memoryId obrigatório" };
  const res = await submitMemoryFeedback({
    memoryId,
    kind: "accurate",
    note: "Confirmado na UI",
  });
  revalidateMemory();
  return { error: res.error };
}

export async function disputeMemoryAction(
  memoryId: string,
  reason: string
): Promise<{ error: string | null }> {
  if (!memoryId || !reason?.trim()) return { error: "Parâmetros inválidos" };
  const res = await disputeMemory(memoryId, reason);
  revalidateMemory();
  return { error: res.error };
}

export async function correctMemoryAction(input: {
  memoryId: string;
  content: string;
  reason: string;
}): Promise<{ error: string | null }> {
  if (!input.memoryId || !input.reason?.trim()) {
    return { error: "Parâmetros inválidos" };
  }
  const res = await correctMemory({
    memoryId: input.memoryId,
    content: input.content,
    reason: input.reason,
  });
  revalidateMemory();
  return { error: res.error };
}

export async function archiveMemoryAction(
  memoryId: string
): Promise<{ error: string | null }> {
  if (!memoryId) return { error: "memoryId obrigatório" };
  const res = await archiveMemory(memoryId);
  revalidateMemory();
  return { error: res.error };
}

export async function forgetMemoryAction(
  memoryId: string
): Promise<{ error: string | null }> {
  if (!memoryId) return { error: "memoryId obrigatório" };
  const res = await deleteMemory(memoryId, "Esquecimento solicitado na UI");
  revalidateMemory();
  return { error: res.error };
}

export async function promoteMemoryAction(
  memoryId: string
): Promise<{ error: string | null }> {
  if (!memoryId) return { error: "memoryId obrigatório" };
  const res = await promoteMemory(memoryId);
  revalidateMemory();
  return { error: res.error };
}
