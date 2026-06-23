export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const GOOGLE_DRIVE_OAUTH_STATE_COOKIE = "google_drive_oauth_state";
export const GOOGLE_DRIVE_EXPERT_OAUTH_STATE_COOKIE = "google_drive_expert_oauth_state";

export function getGoogleDriveRedirectUri(): string {
  const explicit = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/knowledge-sources/google/callback`;
}

export function getExpertBrainGoogleDriveRedirectUri(): string {
  const explicit = process.env.GOOGLE_DRIVE_EXPERT_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/google-drive/callback`;
}
