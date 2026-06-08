import { GMAIL_SCOPES, GMAIL_ALL_SCOPES } from "@/lib/gmail/config";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google-calendar/config";

export function parseGrantedScopes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.trim().split(/\s+/).filter(Boolean);
}

export function hasScope(granted: string[], required: string): boolean {
  return granted.includes(required);
}

export function hasCalendarScope(granted: string[]): boolean {
  return GOOGLE_CALENDAR_SCOPES.every((scope) => hasScope(granted, scope));
}

export function hasGmailReadScope(granted: string[]): boolean {
  const readScope = GMAIL_SCOPES.find((s) => s.includes("gmail.readonly"));
  return readScope ? hasScope(granted, readScope) : false;
}

export function hasGmailSendScope(granted: string[]): boolean {
  const sendScope = GMAIL_SCOPES.find((s) => s.includes("gmail.send"));
  return sendScope ? hasScope(granted, sendScope) : false;
}

export function mergeGrantedScopes(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  const merged = new Set([
    ...parseGrantedScopes(existing),
    ...parseGrantedScopes(incoming),
  ]);
  return merged.size > 0 ? Array.from(merged).join(" ") : null;
}

export function resolveGoogleCapabilities(grantedScopes: string | null | undefined) {
  const scopes = parseGrantedScopes(grantedScopes);
  const gmailRead = hasGmailReadScope(scopes);
  const gmailSend = hasGmailSendScope(scopes);

  return {
    scopes,
    calendar: hasCalendarScope(scopes),
    gmailRead,
    gmailSend,
    gmailEnabled: gmailRead && gmailSend,
    missingGmailScopes: GMAIL_ALL_SCOPES.filter((s) => !scopes.includes(s)),
  };
}
