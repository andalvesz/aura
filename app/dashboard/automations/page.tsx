import { listAutomations } from "@/lib/supabase/services/automation.service";
import { AutomationCenterClient } from "@/components/dashboard/automations/automation-center-client";

export default async function AutomationsPage() {
  const { items } = await listAutomations({ limit: 200 });

  return (
    <div className="mx-auto max-w-3xl p-4">
      <AutomationCenterClient items={items} />
      <p className="mt-6 text-[11px] text-zinc-600">
        executionInfluence apenas em artefatos de automação · planos
        permanecem none
      </p>
    </div>
  );
}
