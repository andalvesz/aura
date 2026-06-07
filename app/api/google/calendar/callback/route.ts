import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  exchangeGoogleCode,
  fetchGoogleUserEmail,
  getGoogleCalendarConnection,
  getGoogleOAuthConfig,
  saveGoogleCalendarConnection,
} from "@/lib/google-calendar";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-calendar/config";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const calendarioUrl = `${siteUrl}/dashboard/calendario`;

  const user = await getUser();
  if (!user) {
    const userError = new Error("Usuário não autenticado no callback Google Calendar");
    console.error("GOOGLE_USER_ERROR", userError);
    return NextResponse.redirect(`${siteUrl}/login?error=auth`);
  }
  const userId = user.id;

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

    const hasAccessToken = Boolean(tokens.access_token);
    let refreshToken = tokens.refresh_token;
    const hasRefreshTokenFromOAuth = Boolean(refreshToken);

    if (!refreshToken) {
      const { connection } = await getGoogleCalendarConnection();
      refreshToken = connection?.refresh_token ?? undefined;
    }

    if (!hasAccessToken) {
      const tokenError = new Error(
        `access_token ausente após troca OAuth (user_id=${userId}, refresh_token=${Boolean(refreshToken)})`
      );
      console.error("GOOGLE_CALLBACK_ERROR", tokenError);
      return NextResponse.redirect(
        `${calendarioUrl}?google=error&msg=${encodeURIComponent(tokenError.message)}`
      );
    }

    if (!refreshToken) {
      const refreshError = new Error(
        `refresh_token ausente após troca OAuth (user_id=${userId}, oauth_refresh=${hasRefreshTokenFromOAuth})`
      );
      console.error("GOOGLE_CALLBACK_ERROR", refreshError);
      return NextResponse.redirect(`${calendarioUrl}?google=no_refresh`);
    }

    const email = await fetchGoogleUserEmail(tokens.access_token);

    const { error } = await saveGoogleCalendarConnection({
      accessToken: tokens.access_token,
      refreshToken,
      expiresIn: tokens.expires_in,
      email,
    });

    if (error) {
      return NextResponse.redirect(
        `${calendarioUrl}?google=save_error&msg=${encodeURIComponent(error)}`
      );
    }

    const response = NextResponse.redirect(`${calendarioUrl}?google=connected`);
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("GOOGLE_CALLBACK_ERROR", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      `${calendarioUrl}?google=error&msg=${encodeURIComponent(message)}`
    );
  }
}
