import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildMetaAuthUrl, getMetaOAuthConfig, META_OAUTH_STATE_COOKIE } from "@/lib/meta";

export async function GET() {
  try {
    await requireUser();

    const oauth = getMetaOAuthConfig();
    if (!oauth) {
      return NextResponse.json(
        { error: "Meta Business não configurado no servidor." },
        { status: 503 }
      );
    }

    const state = crypto.randomUUID();
    const url = buildMetaAuthUrl(state, oauth.redirectUri, oauth.appId);

    const response = NextResponse.redirect(url);
    response.cookies.set(META_OAUTH_STATE_COOKIE, state, {
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
