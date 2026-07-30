import { ScenarioCenterClient } from "@/components/dashboard/scenarios/scenario-center-client";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import {
  listScenarioCards,
  listScenarioComparisons,
} from "@/lib/supabase/services/scenario.service";

export default async function ScenariosPage() {
  let cards: Awaited<ReturnType<typeof listScenarioCards>> = [];
  let comparisons: Awaited<ReturnType<typeof listScenarioComparisons>> = [];
  try {
    cards = await listScenarioCards({ limit: 60 });
  } catch {
    /* unauthenticated */
  }
  try {
    comparisons = await listScenarioComparisons(10);
  } catch {
    /* ignore */
  }

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-4"
      data-testid="scenarios-page"
    >
      <PageBreadcrumb
        items={[
          { label: "Aura", href: "/dashboard" },
          { label: "Scenario Center" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Scenario Center</h1>
        <p className="text-[12px] text-zinc-500">
          Simulações hipotéticas · “o que pode acontecer se…” · sem execução ·
          executionInfluence: none
        </p>
      </div>
      <ScenarioCenterClient
        initial={cards}
        initialComparisons={comparisons}
      />
    </div>
  );
}
