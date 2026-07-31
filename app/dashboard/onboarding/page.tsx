import { OnboardingV2Client } from "@/components/dashboard/onboarding/onboarding-v2-client";
import {
  loadPlatformStateForContext,
  resolveViewerContext,
} from "@/lib/capabilities/services/platform.service";
import { resumeOnboardingFromState } from "@/lib/capabilities";

export default async function OnboardingPage() {
  let userId = "local";
  let initial = null as ReturnType<typeof resumeOnboardingFromState> | null;
  try {
    const ctx = await resolveViewerContext();
    userId = ctx.userId;
    const state = await loadPlatformStateForContext(ctx);
    initial = resumeOnboardingFromState(state, ctx.userId);
  } catch {
    /* unauthenticated fallback */
  }
  return <OnboardingV2Client userId={userId} initial={initial} />;
}
