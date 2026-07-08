import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, getSupabaseEnv } from "@/lib/env";
import {
  clearSupabaseSessionIfBadJwt,
  logSupabaseAuthDiagnostics,
} from "@/lib/supabase/auth-debug";
import {
  SUPABASE_COOKIE_ENCODING,
  supabaseCookieOptions,
  supabaseServerAuthOptions,
} from "@/lib/supabase/cookie-options";

const AUTH_ROUTES = new Set(["/login", "/cadastro"]);
const PROTECTED_PREFIX = "/dashboard";
const AUTH_CALLBACK = "/auth/callback";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie);
  });
}

function nextWithPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function redirectWithCookies(
  request: NextRequest,
  source: NextResponse,
  pathname: string,
  searchParams?: Record<string, string>
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  const response = NextResponse.redirect(url);
  copyCookies(source, response);
  return response;
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!hasSupabaseEnv()) {
    if (pathname.startsWith(PROTECTED_PREFIX)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = nextWithPathname(request, pathname);
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookieEncoding: SUPABASE_COOKIE_ENCODING,
    cookieOptions: supabaseCookieOptions,
    auth: supabaseServerAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = nextWithPathname(request, pathname);
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    await logSupabaseAuthDiagnostics(supabase, `proxy:${pathname}`);
    await clearSupabaseSessionIfBadJwt(supabase, `proxy:${pathname}`);
  }

  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const isProtected = pathname.startsWith(PROTECTED_PREFIX);
  const isAuthCallback = pathname.startsWith(AUTH_CALLBACK);

  if (isAuthCallback) {
    return supabaseResponse;
  }

  if (user && isAuthRoute) {
    return redirectWithCookies(request, supabaseResponse, PROTECTED_PREFIX);
  }

  if (!user && isProtected) {
    return redirectWithCookies(request, supabaseResponse, "/login", {
      redirect: pathname,
    });
  }

  return supabaseResponse;
}
