import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnvDiagnostics } from "@/lib/env";

export function jwtPreview(token: string | null | undefined): string | null {
  if (!token?.trim()) return null;
  return token.slice(0, 20);
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
