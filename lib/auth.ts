import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { safeDashboardPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import {
  clearSupabaseSessionIfBadJwt,
  logSupabaseAuthDiagnostics,
} from "@/lib/supabase/auth-debug";

export async function getUser() {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    await logSupabaseAuthDiagnostics(supabase, "auth.getUser");
    const cleared = await clearSupabaseSessionIfBadJwt(supabase, "auth.getUser");
    if (cleared) return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname");
    const redirectParam =
      pathname && pathname.startsWith("/dashboard")
        ? safeDashboardPath(pathname)
        : "/dashboard";
    redirect(`/login?redirect=${encodeURIComponent(redirectParam)}`);
  }
  return user;
}
