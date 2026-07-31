import Link from "next/link";
import { getHomeLearningWidget } from "@/lib/supabase/services/learning.service";
import { DashboardCard } from "@/components/dashboard/dashboard-card";

export async function LearningHomeWidget() {
  let widget: Awaited<ReturnType<typeof getHomeLearningWidget>> = {
    observedPatterns: [],
    pendingReview: [],
    applied: [],
    evaluating: [],
    needsMoreData: [],
  };
  try {
    widget = await getHomeLearningWidget();
  } catch {
    /* ignore */
  }

  return (
    <section className="space-y-2" data-testid="home-learning-block">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-zinc-200">
          O que o Aura aprendeu
        </h2>
        <Link
          href="/dashboard/learning"
          className="text-[11px] text-violet-300 hover:underline"
        >
          Learning Center →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Propostas aguardando revisão"
          status={widget.pendingReview.length ? "ok" : "empty"}
          emptyTitle="Nada pendente"
          emptyDescription="Rode um ciclo de observação."
          href="/dashboard/learning"
          testId="home-learning-pending"
        >
          <ul className="space-y-1 text-[12px]">
            {widget.pendingReview.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/learning/${p.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Aprendizagens aplicadas"
          status={widget.applied.length ? "ok" : "empty"}
          emptyTitle="Nenhuma aplicada"
          emptyDescription="Confirme e aplique propostas."
          href="/dashboard/learning"
          testId="home-learning-applied"
        >
          <ul className="space-y-1 text-[12px]">
            {widget.applied.map((p) => (
              <li key={p.id} className="text-zinc-300">
                {p.title}
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Avaliações / mais dados"
          status={
            widget.evaluating.length || widget.needsMoreData.length
              ? "ok"
              : "empty"
          }
          emptyTitle="Sem avaliações"
          emptyDescription="Após aplicar, a janela de avaliação começa."
          href="/dashboard/learning"
          testId="home-learning-eval"
        >
          <ul className="space-y-1 text-[12px]">
            {widget.evaluating.map((p) => (
              <li key={p.id} className="text-violet-200/90">
                Avaliando: {p.title}
              </li>
            ))}
            {widget.needsMoreData.map((p) => (
              <li key={p.id} className="text-amber-200/80">
                {p.title}
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>
    </section>
  );
}
