import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseEnvDiagnostics } from "@/lib/env";

export function jwtPreview(token: string | null | undefined): string | null {
  if (!token?.trim()) return null;
  return token.slice(0, 20);
}

/** Mask email for logs (keeps domain + first 2 local chars). */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const [local, domain] = email.trim().split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

/** Audit-only email fingerprint (no secrets; safe to log). */
export function auditEmailNormalization(raw: string) {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const edgeCodes = (value: string) =>
    value.length
      ? {
          first: value.charCodeAt(0),
          last: value.charCodeAt(value.length - 1),
        }
      : null;

  return {
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    hadLeadingOrTrailingWhitespace: raw !== trimmed,
    differsFromLowercase: trimmed !== lower,
    hasUppercase: /[A-Z]/.test(trimmed),
    maskedRaw: maskEmail(raw),
    maskedTrimmed: maskEmail(trimmed),
    maskedLower: maskEmail(lower),
    rawEdgeCharCodes: edgeCodes(raw),
    trimmedEdgeCharCodes: edgeCodes(trimmed),
    /** What we actually send today: trim only (no lowercase). */
    sentToSupabase: trimmed,
    sentMasked: maskEmail(trimmed),
  };
}

export function summarizeAuthCookies(
  cookies: { name: string; value: string }[]
) {
  const authCookies = cookies.filter(
    (c) =>
      c.name.startsWith("sb-") ||
      /supabase|auth-token/i.test(c.name)
  );
  return {
    totalCookies: cookies.length,
    authCookieCount: authCookies.length,
    authCookieNames: authCookies.map((c) => c.name),
    authCookieValueLengths: authCookies.map((c) => ({
      name: c.name,
      length: c.value.length,
    })),
  };
}

/** Serialize Supabase AuthError without dropping original message/code/status. */
export function serializeAuthError(error: AuthError | null | undefined) {
  if (!error) return null;
  const record = error as AuthError & { status?: number; __isAuthError?: boolean };
  return {
    name: record.name ?? "AuthError",
    message: record.message,
    code: record.code ?? null,
    status: record.status ?? null,
  };
}

export function summarizeAuthUser(user: User | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    emailMasked: maskEmail(user.email),
    emailConfirmedAt: user.email_confirmed_at ?? null,
    confirmedAt: user.confirmed_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    createdAt: user.created_at ?? null,
    identitiesCount: user.identities?.length ?? 0,
    hasFullNameMeta: Boolean(user.user_metadata?.full_name),
  };
}

/**
 * Best-effort profile existence check (DB trigger handle_new_user creates it).
 * Does not create/update profiles — audit only.
 */
export async function logProfileCreationCheck(
  supabase: SupabaseClient,
  context: string,
  userId: string | null | undefined
): Promise<void> {
  if (!userId) {
    console.info(`[auth-audit] ${context}:profile_check`, {
      skipped: true,
      reason: "no_user_id",
    });
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at, onboarding_completed, active_context, active_workspace_id")
    .eq("id", userId)
    .maybeSingle();

  console.info(`[auth-audit] ${context}:profile_check`, {
    userId,
    exists: Boolean(data),
    profile: data
      ? {
          id: data.id,
          emailMasked: maskEmail(data.email),
          hasFullName: Boolean(data.full_name),
          createdAt: data.created_at,
          onboardingCompleted: data.onboarding_completed ?? null,
          activeContext: data.active_context ?? null,
          hasActiveWorkspace: Boolean(data.active_workspace_id),
        }
      : null,
    supabaseError: error
      ? { message: error.message, code: error.code, details: error.details, hint: error.hint }
      : null,
    note: "Profile is created by DB trigger public.handle_new_user on auth.users insert — not by app code.",
  });
}

export function isBadJwtError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string };
  return (
    record.code === "bad_jwt" ||
    /invalid jwt/i.test(record.message ?? "") ||
    /unable to parse or verify/i.test(record.message ?? "")
  );
}

export async function logSupabaseAuthDiagnostics(
  supabase: SupabaseClient,
  context: string
): Promise<void> {
  const env = getSupabaseEnvDiagnostics();

  const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
    await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  const accessToken = sessionData.session?.access_token ?? null;

  console.info(`[supabase-auth] ${context}`, {
    url: env.url,
    projectRef: env.projectRef,
    anonKeyPreview: env.anonKeyPreview,
    anonKeyLength: env.anonKeyLength,
    envMismatches: env.mismatches,
    envSources: env.sources,
    jwtPreview: jwtPreview(accessToken),
    jwtLength: accessToken?.length ?? 0,
    getSession: {
      hasSession: Boolean(sessionData.session),
      userId: sessionData.session?.user?.id ?? null,
      error: sessionError?.message ?? null,
      code: (sessionError as { code?: string } | null)?.code ?? null,
    },
    getUser: {
      userId: userData.user?.id ?? null,
      error: userError?.message ?? null,
      code: (userError as { code?: string } | null)?.code ?? null,
    },
  });
}

export async function clearSupabaseSessionIfBadJwt(
  supabase: SupabaseClient,
  context: string
): Promise<boolean> {
  const { error } = await supabase.auth.getUser();
  if (!isBadJwtError(error)) return false;

  console.error(`[supabase-auth] bad_jwt in ${context} — limpando cookies de sessão inválidos`);
  await logSupabaseAuthDiagnostics(supabase, `${context}:bad_jwt`);
  await supabase.auth.signOut();
  return true;
}
