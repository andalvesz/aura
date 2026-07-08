import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** Cliente Supabase para componentes/hooks no browser. */
export function createClient() {
  return createBrowserSupabaseClient();
}
