import type { CookieOptionsWithName } from "@supabase/ssr";

export const SUPABASE_COOKIE_ENCODING = "base64url" as const;

/** Não alterar `name` — o Supabase SSR deriva `sb-<project-ref>-auth-token` da URL. */
export const supabaseCookieOptions: Omit<CookieOptionsWithName, "name"> = {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

export const supabaseBrowserAuthOptions = {
  flowType: "pkce" as const,
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
};

export const supabaseServerAuthOptions = {
  flowType: "pkce" as const,
  persistSession: true,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};
