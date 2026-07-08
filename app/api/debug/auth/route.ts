import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnvDiagnostics } from "@/lib/env";
import { jwtPreview, logSupabaseAuthDiagnostics } from "@/lib/supabase/auth-debug";

export async function GET() {
  try {
    const env = getSupabaseEnvDiagnostics();
    const supabase = await createClient();

    await logSupabaseAuthDiagnostics(supabase, "api:debug/auth");

    const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
      await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

    const accessToken = sessionData.session?.access_token ?? null;

    return Response.json({
      success: true,
      env,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? null : null;
    console.error("[debug/auth] error", { message, stack });
    return Response.json({ success: false, error: message, stack }, { status: 500 });
  }
}
