"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  acceptWorkspaceInvite,
  cancelWorkspaceInvite,
  createWorkspaceInvite,
  removeWorkspaceMember,
  setActiveContext,
  updateWorkspaceMemberRole,
} from "@/lib/supabase/services/workspace.service";
import {
  PublicSiteUrlError,
  resolvePublicSiteUrl,
  siteUrlInputFromHeaders,
} from "@/lib/site-url";
import type { WorkspaceRole } from "@/types/database";

export type WorkspaceActionState = {
  error?: string;
  success?: string;
  inviteUrl?: string;
};

function mapError(code: string | null | undefined): string {
  switch (code) {
    case "forbidden":
      return "Você não tem permissão para esta ação.";
    case "workspace_access_denied":
      return "Acesso ao workspace negado.";
    case "workspace_required":
      return "Nenhum workspace ativo.";
    case "invalid_email":
      return "Informe um e-mail válido.";
    case "admin_cannot_invite_admin":
      return "Admins só podem convidar membros.";
    case "member_not_found":
      return "Membro não encontrado.";
    case "invite_not_found":
      return "Convite inválido.";
    case "invite_expired":
      return "Este convite expirou.";
    case "invite_already_used":
      return "Este convite já foi utilizado.";
    case "invite_email_mismatch":
      return "Este convite é para outro e-mail.";
    case "last_owner_protected":
      return "Não é possível remover o último owner do workspace.";
    case "public_site_url":
      return "URL pública do site não configurada. Defina NEXT_PUBLIC_SITE_URL na Vercel.";
    default:
      return code || "Erro inesperado.";
  }
}

export async function switchAuraContextAction(formData: FormData): Promise<void> {
  const context = String(formData.get("context") ?? "personal");
  const workspaceId = String(formData.get("workspaceId") ?? "") || null;

  const result = await setActiveContext({
    context: context === "workspace" ? "workspace" : "personal",
    workspaceId,
  });

  if (result.error) {
    console.warn("[workspace] switch context failed", result.error);
  }

  revalidatePath("/", "layout");
}

export async function createInviteAction(
  _prev: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("role") ?? "member") as "admin" | "member";
  const workspaceId = String(formData.get("workspaceId") ?? "") || undefined;

  let origin: string;
  try {
    const hdrs = await headers();
    origin = resolvePublicSiteUrl(siteUrlInputFromHeaders(hdrs));
  } catch (err) {
    const message =
      err instanceof PublicSiteUrlError ? err.message : mapError("public_site_url");
    console.error("[workspace] invite site-url failed", {
      env: process.env.NODE_ENV,
      error: message,
    });
    return { error: message };
  }

  const result = await createWorkspaceInvite({
    email,
    role: role === "admin" ? "admin" : "member",
    workspaceId,
    origin,
  });

  if (result.error) {
    return { error: mapError(result.error) };
  }

  revalidatePath("/dashboard/workspace");
  return {
    success: "Convite criado. Copie o link e envie ao sócio.",
    inviteUrl: result.inviteUrl ?? undefined,
  };
}

export async function cancelInviteAction(formData: FormData): Promise<void> {
  const inviteId = String(formData.get("inviteId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "") || undefined;
  await cancelWorkspaceInvite(inviteId, workspaceId);
  revalidatePath("/dashboard/workspace");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const memberId = String(formData.get("memberId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "") || undefined;
  await removeWorkspaceMember(memberId, workspaceId);
  revalidatePath("/dashboard/workspace");
}

export async function updateMemberRoleAction(formData: FormData): Promise<void> {
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "member") as WorkspaceRole;
  const workspaceId = String(formData.get("workspaceId") ?? "") || undefined;
  await updateWorkspaceMemberRole({ memberId, role, workspaceId });
  revalidatePath("/dashboard/workspace");
}

export async function acceptInviteAction(
  _prev: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Token ausente." };

  const result = await acceptWorkspaceInvite(token);
  if (result.error) {
    const msg = result.error.includes("invite_")
      ? mapError(result.error.replace(/^.*invite_/, "invite_").split(/[\s:]/)[0]!)
      : mapError(
          result.error.includes("expired")
            ? "invite_expired"
            : result.error.includes("already")
              ? "invite_already_used"
              : result.error.includes("mismatch") || result.error.includes("email")
                ? "invite_email_mismatch"
                : result.error.includes("not_found") || result.error.includes("Invite")
                  ? "invite_not_found"
                  : result.error
        );
    // Parse Postgres exception messages from RPC
    const lower = result.error.toLowerCase();
    if (lower.includes("invite_expired")) return { error: mapError("invite_expired") };
    if (lower.includes("invite_already_used")) return { error: mapError("invite_already_used") };
    if (lower.includes("invite_email_mismatch")) return { error: mapError("invite_email_mismatch") };
    if (lower.includes("invite_not_found")) return { error: mapError("invite_not_found") };
    return { error: msg };
  }

  revalidatePath("/", "layout");
  return { success: "Convite aceito. Bem-vindo à Alvesz." };
}
