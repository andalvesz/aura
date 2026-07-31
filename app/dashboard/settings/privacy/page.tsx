import { PrivacyCenterClient } from "@/components/dashboard/settings/privacy-center-client";
import { DEFAULT_PRIVACY_PREFS, getPrivacyPrefs } from "@/lib/capabilities";
import { resolveViewerContext } from "@/lib/capabilities/services/platform.service";

export default async function PrivacySettingsPage() {
  let prefs = DEFAULT_PRIVACY_PREFS;
  try {
    const ctx = await resolveViewerContext();
    prefs = getPrivacyPrefs(ctx.userId);
  } catch {
    /* fallback */
  }
  return <PrivacyCenterClient initial={prefs} />;
}
