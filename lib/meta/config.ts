export const META_OAUTH_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "pages_read_engagement",
  "pages_show_list",
  "read_insights",
];

export const META_OAUTH_STATE_COOKIE = "meta_oauth_state";
export const META_GRAPH_VERSION = "v21.0";

export function getMetaRedirectUri(): string {
  const explicit = process.env.META_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/meta/callback`;
}

export function getMetaOAuthConfig() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    return null;
  }

  return {
    appId,
    appSecret,
    redirectUri: getMetaRedirectUri(),
  };
}
