import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";
import {
  SUPABASE_COOKIE_ENCODING,
  supabaseBrowserAuthOptions,
  supabaseCookieOptions,
} from "@/lib/supabase/cookie-options";

export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();

  return createBrowserClient<Database>(url, anonKey, {
    cookieEncoding: SUPABASE_COOKIE_ENCODING,
    cookieOptions: supabaseCookieOptions,
    isSingleton: true,
    auth: supabaseBrowserAuthOptions,
  });
}
