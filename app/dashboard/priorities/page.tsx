import { PriorityCenterClient } from "@/components/dashboard/priorities/priority-center-client";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { listPriorityItems } from "@/lib/supabase/services/prioritization.service";

export default async function PrioritiesPage() {
  let items: Awaited<ReturnType<typeof listPriorityItems>> = [];
  try {
    items = await listPriorityItems({ limit: 60, ranked: true });
  } catch {
    /* unauthenticated */
  }

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-4"
      data-testid="priorities-page"
    >
      <PageBreadcrumb
        items={[
          { label: "Aura", href: "/dashboard" },
          { label: "Priority Center" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Priority Center</h1>
        <p className="text-[12px] text-zinc-500">
          O que merece mais atenção agora · sem execução · sem planner ·
          executionInfluence: none
        </p>
      </div>
      <PriorityCenterClient initial={items} />
    </div>
  );
}
