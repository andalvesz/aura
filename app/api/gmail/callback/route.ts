import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDataContext } from "@/lib/supabase/services/context";
import { exchangeGoogleCode, fetchGoogleUserEmail, tokenExpiresAt } from "@/lib/google-calendar/oauth";
import { getGoogleOAuthConfig } from "@/lib/google-calendar/config";
import { getGoogleAccountConnection } from "@/lib/google/token.service";
import { GMAIL_OAUTH_STATE_COOKIE, getGmailRedirectUri } from "@/lib/gmail/config";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const commsUrl = `${siteUrl}/dashboard/comunicacao`;

  try {
    await requireUser();
  } catch {
    return NextResponse.redirect(`${siteUrl}/login?error=auth`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${commsUrl}?gmail=error`);
  }

  const cookieState = request.headers.get("cookie")?.match(
    new RegExp(`${GMAIL_OAUTH_STATE_COOKIE}=([^;]+)`)
  )?.[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${commsUrl}?gmail=denied`);
  }

  const oauth = getGoogleOAuthConfig();
  if (!oauth) {
    return NextResponse.redirect(`${commsUrl}?gmail=unconfigured`);
  }

  try {
    const tokens = await exchangeGoogleCode(
      code,
      getGmailRedirectUri(),
      oauth.clientId,
      oauth.clientSecret
    );

    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const { connection } = await getGoogleAccountConnection();
      refreshToken = connection?.refresh_token ?? undefined;
    }

    if (!refreshToken) {
      return NextResponse.redirect(`${commsUrl}?gmail=no_refresh`);
    }

    const email = await fetchGoogleUserEmail(tokens.access_token);
    const { supabase, userId } = await getDataContext();

    const { error } = await supabase.from("google_calendar_connections").upsert(
      {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        expires_at: tokenExpiresAt(tokens.expires_in),
        google_email: email,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return NextResponse.redirect(`${commsUrl}?gmail=save_error`);
    }

    const response = NextResponse.redirect(`${commsUrl}?gmail=connected`);
    response.cookies.delete(GMAIL_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("[gmail/callback]", err);
    return NextResponse.redirect(`${commsUrl}?gmail=error`);
  }
}
