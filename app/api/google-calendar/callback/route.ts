import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  exchangeGoogleCode,
  fetchGoogleUserEmail,
  getGoogleCalendarConnection,
  getGoogleOAuthConfig,
  importGoogleCalendarEvents,
  saveGoogleCalendarConnection,
} from "@/lib/google-calendar";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-calendar/config";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const calendarioUrl = `${siteUrl}/dashboard/calendario`;

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
    return NextResponse.redirect(`${calendarioUrl}?google=error`);
  }

  const cookieState = request.headers.get("cookie")?.match(
    new RegExp(`${GOOGLE_OAUTH_STATE_COOKIE}=([^;]+)`)
  )?.[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${calendarioUrl}?google=denied`);
  }

  const oauth = getGoogleOAuthConfig();
  if (!oauth) {
    return NextResponse.redirect(`${calendarioUrl}?google=unconfigured`);
  }

  try {
    const tokens = await exchangeGoogleCode(
      code,
      oauth.redirectUri,
      oauth.clientId,
      oauth.clientSecret
    );

    let refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      const { connection } = await getGoogleCalendarConnection();
      refreshToken = connection?.refresh_token ?? undefined;
    }

    if (!refreshToken) {
      return NextResponse.redirect(`${calendarioUrl}?google=no_refresh`);
    }

    const email = await fetchGoogleUserEmail(tokens.access_token);

    const { error } = await saveGoogleCalendarConnection({
      accessToken: tokens.access_token,
      refreshToken,
      expiresIn: tokens.expires_in,
      email,
      grantedScopes: tokens.scope ?? null,
    });

    if (error) {
      return NextResponse.redirect(`${calendarioUrl}?google=save_error`);
    }

    const imported = await importGoogleCalendarEvents();
    const importQuery =
      imported.error == null
        ? `&imported=${imported.imported}&updated=${imported.updated}`
        : "";

    const response = NextResponse.redirect(
      `${calendarioUrl}?google=connected${importQuery}`
    );
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("[google-calendar/callback]", err);
    return NextResponse.redirect(`${calendarioUrl}?google=error`);
  }
}
