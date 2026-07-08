import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import {
  SUPABASE_COOKIE_ENCODING,
  supabaseCookieOptions,
  supabaseServerAuthOptions,
} from "@/lib/supabase/cookie-options";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookieEncoding: SUPABASE_COOKIE_ENCODING,
    cookieOptions: supabaseCookieOptions,
    auth: supabaseServerAuthOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — proxy renova a sessão
        }
      },
    },
  });
}
