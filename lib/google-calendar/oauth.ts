import { GOOGLE_CALENDAR_SCOPES } from "./config";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

type GoogleUserInfo = {
  email?: string;
  name?: string;
};

export type GoogleUserProfile = {
  email: string | null;
  name: string | null;
};

export function buildGoogleAuthUrl(state: string, redirectUri: string, clientId: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao trocar código OAuth: ${err}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao renovar token: ${err}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return { email: null, name: null };

  const data = (await res.json()) as GoogleUserInfo;
  return {
    email: data.email?.trim() || null,
    name: data.name?.trim() || null,
  };
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const profile = await fetchGoogleUserProfile(accessToken);
  return profile.email;
}

export function tokenExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
