import { META_GRAPH_VERSION, META_OAUTH_SCOPES } from "./config";

type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export function buildMetaAuthUrl(state: string, redirectUri: string, appId: string) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: META_OAUTH_SCOPES.join(","),
    state,
  });

  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function exchangeMetaCode(
  code: string,
  redirectUri: string,
  appId: string,
  appSecret: string
): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao trocar código OAuth Meta: ${err}`);
  }

  return res.json() as Promise<MetaTokenResponse>;
}

export async function exchangeMetaLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?${params.toString()}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao obter token long-lived Meta: ${err}`);
  }

  return res.json() as Promise<MetaTokenResponse>;
}

export function metaTokenExpiresAt(expiresInSeconds?: number): string | null {
  if (!expiresInSeconds || expiresInSeconds <= 0) return null;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
