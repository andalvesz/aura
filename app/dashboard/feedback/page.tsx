import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedbackCenterClient } from "@/components/dashboard/beta-ops/feedback-center-client";
import { listFeedbackForUser } from "@/lib/beta-ops";
import { ensureBetaActive, canAccessBeta } from "@/lib/capabilities/beta-access";

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  ensureBetaActive(user.id);
  if (!canAccessBeta(user.id)) redirect("/dashboard");
  const items = listFeedbackForUser(user.id);
  return <FeedbackCenterClient initial={items} />;
}
