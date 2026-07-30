import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { AutonomyControls } from "@/components/dashboard/aura-brain-autonomy-controls";
import type { AuraBrainActivityItem } from "@/lib/aura-brain/communication/presenter";
import type { AuraBrainRunResult } from "@/lib/aura-brain/types";

const KIND_LABEL: Record<AuraBrainActivityItem["kind"], string> = {
  suggested: "Sugerida",
  prepared: "Preparada",
  awaiting_confirmation: "Aguardando",
  executed: "Executada",
  failed: "Falha",
};

export function AuraBrainActivityPanel({
  brain,
  activity,
}: {
  brain: AuraBrainRunResult;
  activity: AuraBrainActivityItem[];
}) {
  const plan = brain.plans[0] ?? null;

  return (
    <section className="space-y-3" data-testid="aura-brain-activity">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Aura Brain
          </p>
          <p className="text-[13px] text-zinc-400">
            Autonomia {brain.context.autonomy}
            {process.env.NODE_ENV === "development"
              ? ` · planner ${brain.meta.plannerMs}ms · auto ${brain.meta.automationMs}ms`
              : ""}
          </p>
        </div>
        <Link
          href="/dashboard/settings/aura-brain"
          className="text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          Configurar
        </Link>
      </div>

      <AutonomyControls current={brain.context.autonomy} />

      {plan ? (
        <DashboardCard
          title="Plano recomendado"
          status="ok"
          testId="aura-brain-plan"
        >
          <div className="space-y-1 text-[12px] text-zinc-300">
            <p className="font-medium text-zinc-100">{plan.title}</p>
            <p className="text-zinc-500">{plan.objective}</p>
            <p className="text-[11px] text-zinc-600">
              {plan.status} · confiança {Math.round(plan.confidence * 100)}%
            </p>
          </div>
        </DashboardCard>
      ) : null}

      <DashboardCard
        title="Atividade do Aura Brain"
        status={activity.length ? "ok" : "empty"}
        emptyTitle="Sem atividade recente"
        emptyDescription="Quando houver prioridades ou ações, elas aparecem aqui."
        testId="aura-brain-activity-list"
      >
        <ul className="space-y-2">
          {activity.map((item) => (
            <li key={item.id} className="text-[12px]" data-activity-kind={item.kind}>
              <p className="text-zinc-200">{item.title}</p>
              <p className="text-[11px] text-zinc-600">
                {KIND_LABEL[item.kind]} · {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </DashboardCard>
    </section>
  );
}
