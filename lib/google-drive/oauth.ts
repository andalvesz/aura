import { GOOGLE_DRIVE_SCOPES } from "./config";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export function buildGoogleDriveAuthUrl(state: string, redirectUri: string, clientId: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleDriveCode(
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
    throw new Error(`Falha ao trocar código OAuth Drive: ${err}`);
  }

  return res.json() as Promise<TokenResponse>;
}
