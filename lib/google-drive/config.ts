import { assertPublicRedirectUri, getPublicSiteUrl } from "@/lib/site-url";

export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const GOOGLE_DRIVE_OAUTH_STATE_COOKIE = "google_drive_oauth_state";
export const GOOGLE_DRIVE_EXPERT_OAUTH_STATE_COOKIE = "google_drive_expert_oauth_state";

export function getGoogleDriveRedirectUri(): string {
  const explicit = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  if (explicit) return assertPublicRedirectUri(explicit, "GOOGLE_DRIVE_REDIRECT_URI");

  return `${getPublicSiteUrl()}/api/knowledge-sources/google/callback`;
}

export function getExpertBrainGoogleDriveRedirectUri(): string {
  const explicit = process.env.GOOGLE_DRIVE_EXPERT_REDIRECT_URI?.trim();
  if (explicit) {
    return assertPublicRedirectUri(explicit, "GOOGLE_DRIVE_EXPERT_REDIRECT_URI");
  }

  return `${getPublicSiteUrl()}/api/google-drive/callback`;
}
