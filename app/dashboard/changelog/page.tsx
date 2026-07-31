import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChangelogClient } from "@/components/dashboard/beta-ops/changelog-client";
import {
  getBetaOpsState,
  listReleasedChangelog,
  listVisibleAnnouncements,
  getCurrentReleaseVersion,
} from "@/lib/beta-ops";
import { ensureBetaActive, canAccessBeta } from "@/lib/capabilities/beta-access";

export default async function ChangelogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  ensureBetaActive(user.id);
  if (!canAccessBeta(user.id)) redirect("/dashboard");

  const state = getBetaOpsState();
  const releases = listReleasedChangelog(state);
  const announcements = listVisibleAnnouncements(state, {
    userId: user.id,
    workspaceId: null,
  });
  const readReleaseIds = state.releaseReads
    .filter((r) => r.userId === user.id)
    .map((r) => r.releaseId);

  return (
    <ChangelogClient
      releases={releases}
      announcements={announcements}
      currentVersion={getCurrentReleaseVersion(state) ?? "10.2.0-beta"}
      readReleaseIds={readReleaseIds}
    />
  );
}
