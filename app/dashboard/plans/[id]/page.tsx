import { notFound } from "next/navigation";
import { PlanViewClient } from "@/components/dashboard/plans/plan-view-client";
import {
  explainPlanItem,
  getPlanItem,
  listPlanComments,
} from "@/lib/supabase/services/planner.service";
import { listAutomations } from "@/lib/supabase/services/automation.service";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let plan = null;
  let explanation = null;
  let comments: Awaited<ReturnType<typeof listPlanComments>> = [];
  let linkedAutomations: Awaited<
    ReturnType<typeof listAutomations>
  >["items"] = [];
  try {
    plan = await getPlanItem(id);
    if (plan) {
      explanation = await explainPlanItem(id);
      comments = await listPlanComments(id);
      linkedAutomations = (await listAutomations({ planId: id, limit: 50 }))
        .items;
    }
  } catch {
    plan = null;
  }
  if (!plan) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl py-2">
      <PlanViewClient
        plan={plan}
        explanation={explanation}
        comments={comments}
        linkedAutomations={linkedAutomations}
      />
    </div>
  );
}
