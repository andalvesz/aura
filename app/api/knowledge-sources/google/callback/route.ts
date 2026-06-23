import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  exchangeGoogleDriveCode,
  getGoogleDriveOAuthConfig,
  GOOGLE_DRIVE_OAUTH_STATE_COOKIE,
} from "@/lib/google-drive";
import { getGoogleAccountConnection } from "@/lib/google/token.service";
import { fetchGoogleUserEmail, fetchGoogleUserProfile } from "@/lib/google-calendar/oauth";
import { saveGoogleDriveConnection } from "@/lib/supabase/services/knowledge-sources.service";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  const redirectBase = `${siteUrl.replace(/\/$/, "")}/dashboard/knowledge-sources`;

  try {
    await requireUser();

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      return NextResponse.redirect(`${redirectBase}?drive_error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${redirectBase}?drive_error=missing_code`);
    }

    const cookieStore = await cookies();
    const savedState = cookieStore.get(GOOGLE_DRIVE_OAUTH_STATE_COOKIE)?.value;
    if (!savedState || savedState !== state) {
      return NextResponse.redirect(`${redirectBase}?drive_error=invalid_state`);
    }

    const oauth = getGoogleDriveOAuthConfig();
    if (!oauth) {
      return NextResponse.redirect(`${redirectBase}?drive_error=not_configured`);
    }

    const tokens = await exchangeGoogleDriveCode(
      code,
      oauth.redirectUri,
      oauth.clientId,
      oauth.clientSecret
    );

    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const { connection } = await getGoogleAccountConnection();
      refreshToken = connection?.refresh_token ?? undefined;
    }

    if (!refreshToken) {
      return NextResponse.redirect(`${redirectBase}?drive_error=no_refresh`);
    }

    const profile = await fetchGoogleUserProfile(tokens.access_token);

    const { error } = await saveGoogleDriveConnection({
      accessToken: tokens.access_token,
      refreshToken,
      expiresIn: tokens.expires_in,
      email: profile.email,
      displayName: profile.name,
      grantedScopes: tokens.scope ?? null,
    });

    const response = NextResponse.redirect(
      error ? `${redirectBase}?drive_error=${encodeURIComponent(error)}` : `${redirectBase}?drive_connected=1`
    );
    response.cookies.delete(GOOGLE_DRIVE_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "callback_failed";
    return NextResponse.redirect(`${redirectBase}?drive_error=${encodeURIComponent(message)}`);
  }
}
