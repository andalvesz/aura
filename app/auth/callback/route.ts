import { NextResponse } from "next/server";
import { safeAuthNextPath } from "@/lib/redirect";
import {
  logProfileCreationCheck,
  maskEmail,
  serializeAuthError,
  summarizeAuthUser,
} from "@/lib/supabase/auth-debug";
import {
  PublicSiteUrlError,
  resolvePublicSiteUrl,
} from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host");

  let origin: string;
  try {
    origin = resolvePublicSiteUrl({
      requestOrigin,
      forwardedHost,
      forwardedProto,
      host,
    });
  } catch (err) {
    const message =
      err instanceof PublicSiteUrlError ? err.message : "public_site_url";
    console.error("[auth-audit] email_confirm:site-url failed", { error: message });
    // Last resort for callback: if request itself is non-localhost, use it
    if (requestOrigin && !/localhost|127\.0\.0\.1/i.test(requestOrigin)) {
      origin = requestOrigin.replace(/\/$/, "");
    } else {
      return new NextResponse(message, { status: 500 });
    }
  }

  const code = searchParams.get("code");
  const next = safeAuthNextPath(searchParams.get("next"));
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const errorCode = searchParams.get("error_code");

  console.info("[auth-audit] email_confirm:callback_hit", {
    requestOrigin,
    origin,
    hasCode: Boolean(code),
    codeLength: code?.length ?? 0,
    next,
    queryError: errorParam,
    queryErrorCode: errorCode,
    queryErrorDescription: errorDescription,
  });

  if (errorParam || errorDescription) {
    console.info("[auth-audit] email_confirm:provider_query_error", {
      error: errorParam,
      errorCode,
      errorDescription,
      redirectTo: `${origin}/login?error=auth`,
      note: "Supabase redirected here with error_* query params (email link / OAuth).",
    });
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.info("[auth-audit] email_confirm:exchangeCodeForSession", {
      supabaseError: serializeAuthError(error),
      user: summarizeAuthUser(data.user),
      hasSession: Boolean(data.session),
    });

    if (!error) {
      await logProfileCreationCheck(
        supabase,
        "email_confirm",
        data.user?.id ?? data.session?.user?.id
      );

      console.info("[auth-audit] email_confirm:success", {
        userId: data.user?.id ?? data.session?.user?.id ?? null,
        emailMasked: maskEmail(data.user?.email ?? data.session?.user?.email),
        redirectTo: `${origin}${next}`,
      });
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.info("[auth-audit] email_confirm:failed", {
      supabaseOriginalMessage: error.message,
      supabaseOriginalCode: error.code ?? null,
      supabaseOriginalStatus: (error as { status?: number }).status ?? null,
      redirectTo: `${origin}/login?error=auth`,
      uiNotice: "Falha na autenticação. Tente novamente.",
      uiNoticeSource: "frontend_login_page_query_map",
    });
  } else {
    console.info("[auth-audit] email_confirm:missing_code", {
      redirectTo: `${origin}/login?error=auth`,
    });
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
