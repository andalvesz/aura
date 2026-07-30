"use server";

import { revalidatePath } from "next/cache";
import {
  archiveIdentityClaim,
  confirmIdentityClaim,
  correctIdentityClaim,
  createIdentityClaim,
  deleteIdentityClaim,
  rejectIdentityClaim,
} from "@/lib/supabase/services/identity-engine.service";
import type { CreateIdentityClaimInput } from "@/lib/identity/types";

function revalidateIdentity(): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/identity");
  revalidatePath("/dashboard/settings/aura-brain");
}

export async function createIdentityClaimAction(
  input: CreateIdentityClaimInput
): Promise<{ error: string | null; claimId?: string }> {
  if (!input.label?.trim() || !input.key?.trim()) {
    return { error: "Chave e rótulo obrigatórios" };
  }
  const res = await createIdentityClaim({
    ...input,
    sourceType: input.sourceType || "manual_entry",
    confirmNow: input.confirmNow ?? true,
  });
  revalidateIdentity();
  return { error: res.error, claimId: res.claim?.id };
}

export async function confirmIdentityClaimAction(
  claimId: string
): Promise<{ error: string | null }> {
  if (!claimId) return { error: "claimId obrigatório" };
  const res = await confirmIdentityClaim(claimId);
  revalidateIdentity();
  return { error: res.error };
}

export async function rejectIdentityClaimAction(
  claimId: string,
  reason: string
): Promise<{ error: string | null }> {
  if (!claimId || !reason?.trim()) return { error: "Parâmetros inválidos" };
  const res = await rejectIdentityClaim(claimId, reason);
  revalidateIdentity();
  return { error: res.error };
}

export async function correctIdentityClaimAction(input: {
  claimId: string;
  value: string;
  reason: string;
}): Promise<{ error: string | null }> {
  if (!input.claimId || !input.reason?.trim()) {
    return { error: "Parâmetros inválidos" };
  }
  const res = await correctIdentityClaim({
    claimId: input.claimId,
    value: input.value,
    reason: input.reason,
  });
  revalidateIdentity();
  return { error: res.error };
}

export async function archiveIdentityClaimAction(
  claimId: string
): Promise<{ error: string | null }> {
  if (!claimId) return { error: "claimId obrigatório" };
  const res = await archiveIdentityClaim(claimId);
  revalidateIdentity();
  return { error: res.error };
}

export async function deleteIdentityClaimAction(
  claimId: string
): Promise<{ error: string | null }> {
  if (!claimId) return { error: "claimId obrigatório" };
  const res = await deleteIdentityClaim(claimId);
  revalidateIdentity();
  return { error: res.error };
}
