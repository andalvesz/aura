import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google-calendar/config";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

export const GMAIL_OAUTH_STATE_COOKIE = "gmail_oauth_state";

export const GMAIL_ALL_SCOPES = [...GOOGLE_CALENDAR_SCOPES, ...GMAIL_SCOPES];

export function getGmailRedirectUri(): string {
  const explicit = process.env.GMAIL_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/api/gmail/callback`;
}
