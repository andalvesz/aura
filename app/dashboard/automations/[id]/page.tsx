import { notFound } from "next/navigation";
import {
  explainAutomation,
  getAutomation,
  listAutomationAudit,
} from "@/lib/supabase/services/automation.service";
import { AutomationViewClient } from "@/components/dashboard/automations/automation-view-client";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { automation } = await getAutomation(id);
  if (!automation) notFound();

  const [{ explanation }, audits] = await Promise.all([
    explainAutomation(id),
    listAutomationAudit(id),
  ]);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <AutomationViewClient
        automation={automation}
        explanation={explanation}
        audits={audits}
      />
    </div>
  );
}
