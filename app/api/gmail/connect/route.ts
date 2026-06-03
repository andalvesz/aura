import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getGoogleOAuthConfig } from "@/lib/google-calendar/config";
import { GMAIL_ALL_SCOPES, GMAIL_OAUTH_STATE_COOKIE, getGmailRedirectUri } from "@/lib/gmail/config";

export async function GET() {
  try {
    await requireUser();

    const oauth = getGoogleOAuthConfig();
    if (!oauth) {
      return NextResponse.json(
        { error: "Google não configurado no servidor." },
        { status: 503 }
      );
    }

    const state = crypto.randomUUID();
    const redirectUri = getGmailRedirectUri();
    const params = new URLSearchParams({
      client_id: oauth.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_ALL_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
      include_granted_scopes: "true",
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const response = NextResponse.redirect(url);
    response.cookies.set(GMAIL_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
    );
  }
}
