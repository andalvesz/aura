import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { safeDashboardPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function getUser() {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
