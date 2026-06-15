import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  exchangeMetaCode,
  exchangeMetaLongLivedToken,
  getMetaOAuthConfig,
  metaTokenExpiresAt,
  META_OAUTH_STATE_COOKIE,
  META_OAUTH_SCOPES,
} from "@/lib/meta";
import {
  connectMetaBusiness,
  importMetaOAuthEntities,
} from "@/lib/supabase/services/meta-connect.service";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const metaUrl = `${siteUrl}/dashboard/platforms/meta`;

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
    return NextResponse.redirect(`${metaUrl}?meta=denied`);
  }

  const cookieState = request.headers
    .get("cookie")
    ?.match(new RegExp(`${META_OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${metaUrl}?meta=denied`);
  }

  const oauth = getMetaOAuthConfig();
  if (!oauth) {
    return NextResponse.redirect(`${metaUrl}?meta=unconfigured`);
  }

  try {
    const shortLived = await exchangeMetaCode(
      code,
      oauth.redirectUri,
      oauth.appId,
      oauth.appSecret
    );

    const longLived = await exchangeMetaLongLivedToken(
      shortLived.access_token,
      oauth.appId,
      oauth.appSecret
    );

    const { error: connectError } = await connectMetaBusiness({
      accessToken: longLived.access_token,
      tokenExpiresAt: metaTokenExpiresAt(longLived.expires_in),
      scopes: META_OAUTH_SCOPES,
    });

    if (connectError) {
      return NextResponse.redirect(`${metaUrl}?meta=save_error`);
    }

    const imported = await importMetaOAuthEntities(longLived.access_token);
    const importQuery = imported.error
      ? ""
      : `&businessManagers=${imported.businessManagers}&adAccounts=${imported.adAccounts}&pages=${imported.pages}&pixels=${imported.pixels}`;

    const response = NextResponse.redirect(`${metaUrl}?meta=connected${importQuery}`);
    response.cookies.delete(META_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("[meta/callback]", err);
    return NextResponse.redirect(`${metaUrl}?meta=error`);
  }
}
