import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildGoogleAuthUrl, getGoogleOAuthConfig } from "@/lib/google-calendar";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/google-calendar/config";
import { absolutePublicUrl } from "@/lib/site-url";

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
    return NextResponse.redirect(absolutePublicUrl("/login"));
  }
}
