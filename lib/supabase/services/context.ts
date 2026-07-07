import { getUser, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AuraAuditContext = {
  user: User;
  supabase: SupabaseClient<Database>;
  userId: string;
};

declare global {
  var __AURA_AUDIT_CTX__: AuraAuditContext | undefined;
}

export async function getDataContext() {
  const user = await requireUser();
  const supabase = await createClient();
  return { user, supabase, userId: user.id };
}

export async function getOptionalDataContext(): Promise<AuraAuditContext | null> {
  if (globalThis.__AURA_AUDIT_CTX__) {
    return globalThis.__AURA_AUDIT_CTX__;
  }

  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  return { user, supabase, userId: user.id };
}

export async function resolveUserDisplayName(
  ctx: NonNullable<Awaited<ReturnType<typeof getOptionalDataContext>>>
): Promise<string> {
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();

  const fullName =
    profile?.full_name ??
    (ctx.user.user_metadata?.full_name as string | undefined) ??
    null;

  const trimmed = fullName?.trim();
  if (trimmed) {
    const first = trimmed.split(/\s+/)[0];
    return first || trimmed;
  }
  const fromEmail = ctx.user.email?.split("@")[0]?.trim();
  return fromEmail || "você";
}
