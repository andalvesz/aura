import { LearningCenterClient } from "@/components/dashboard/learning/learning-center-client";
import { listLearningProposals } from "@/lib/supabase/services/learning.service";

export default async function LearningPage() {
  let items: Awaited<ReturnType<typeof listLearningProposals>>["items"] = [];
  try {
    items = (await listLearningProposals()).items;
  } catch {
    items = [];
  }
  return <LearningCenterClient initial={items} />;
}
