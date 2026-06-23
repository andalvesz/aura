export * from "./config";
export * from "./oauth";
export * from "./client";

import { getGoogleOAuthConfig } from "@/lib/google-calendar/config";
import { getExpertBrainGoogleDriveRedirectUri, getGoogleDriveRedirectUri } from "./config";

export function getGoogleDriveOAuthConfig() {
  const oauth = getGoogleOAuthConfig();
  if (!oauth) return null;
  return {
    ...oauth,
    redirectUri: getGoogleDriveRedirectUri(),
  };
}

export function getExpertBrainGoogleDriveOAuthConfig() {
  const oauth = getGoogleOAuthConfig();
  if (!oauth) return null;
  return {
    ...oauth,
    redirectUri: getExpertBrainGoogleDriveRedirectUri(),
  };
}
