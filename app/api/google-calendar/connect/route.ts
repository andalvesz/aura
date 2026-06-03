import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildGoogleAuthUrl, getGoogleOAuthConfig } from "@/lib/google-calendar";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-calendar/config";

export async function GET() {
  try {
    await requireUser();

    const oauth = getGoogleOAuthConfig();
    if (!oauth) {
      return NextResponse.json(
        { error: "Google Calendar não configurado no servidor." },
        { status: 503 }
      );
    }

    const state = crypto.randomUUID();
    const url = buildGoogleAuthUrl(state, oauth.redirectUri, oauth.clientId);

    const response = NextResponse.redirect(url);
    response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
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
