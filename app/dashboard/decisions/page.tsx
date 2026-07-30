import { DecisionCenterClient } from "@/components/dashboard/decisions/decision-center-client";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { listDecisionCards } from "@/lib/supabase/services/decision-support.service";

export default async function DecisionsPage() {
  let cards: Awaited<ReturnType<typeof listDecisionCards>> = [];
  try {
    cards = await listDecisionCards({ limit: 60, ranked: true });
  } catch {
    /* unauthenticated */
  }

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-4"
      data-testid="decisions-page"
    >
      <PageBreadcrumb
        items={[
          { label: "Aura", href: "/dashboard" },
          { label: "Decision Center" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Decision Center</h1>
        <p className="text-[12px] text-zinc-500">
          Apoio à decisão explicável · sem execução · sem automações ·
          executionInfluence: none
        </p>
      </div>
      <DecisionCenterClient initial={cards} />
    </div>
  );
}
