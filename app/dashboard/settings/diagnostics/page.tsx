import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiagnosticsClient } from "@/components/dashboard/beta-ops/diagnostics-client";
import {
  buildDiagnosticsSnapshot,
  sanitizeDiagnosticsForCopy,
} from "@/lib/beta-ops";
import {
  loadPlatformStateForContext,
  resolveViewerContext,
} from "@/lib/capabilities/services/platform.service";
import { ensureBetaActive, canAccessBeta } from "@/lib/capabilities/beta-access";

export default async function DiagnosticsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  ensureBetaActive(user.id);
  if (!canAccessBeta(user.id)) redirect("/dashboard");

  let ctx;
  try {
    ctx = await resolveViewerContext();
  } catch {
    redirect("/login");
  }
  await loadPlatformStateForContext(ctx);
  const snap = buildDiagnosticsSnapshot({ ctx });
  return (
    <DiagnosticsClient
      initialCopyText={sanitizeDiagnosticsForCopy(snap)}
      version={snap.version}
    />
  );
}
