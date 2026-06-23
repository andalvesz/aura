import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  buildGoogleDriveAuthUrl,
  getGoogleDriveOAuthConfig,
  GOOGLE_DRIVE_OAUTH_STATE_COOKIE,
} from "@/lib/google-drive";

export async function GET() {
  try {
    await requireUser();

    const oauth = getGoogleDriveOAuthConfig();
    if (!oauth) {
      return NextResponse.json(
        { error: "Google OAuth não configurado no servidor." },
        { status: 503 }
      );
    }

    const state = crypto.randomUUID();
    const url = buildGoogleDriveAuthUrl(state, oauth.redirectUri, oauth.clientId);

    const response = NextResponse.redirect(url);
    response.cookies.set(GOOGLE_DRIVE_OAUTH_STATE_COOKIE, state, {
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
