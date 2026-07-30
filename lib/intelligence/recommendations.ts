/**
 * Rule-based recommendations — never invent without data.
 */

import type {
  AuraIntelligenceInput,
  IntelligenceRecommendation,
  RuleResult,
} from "@/lib/intelligence/types";

export function buildRecommendations(
  input: AuraIntelligenceInput,
  ruleResults: RuleResult[]
): IntelligenceRecommendation[] {
  const out: IntelligenceRecommendation[] = [];
  const seen = new Set<string>();

  const push = (rec: IntelligenceRecommendation) => {
    if (seen.has(rec.id)) return;
    seen.add(rec.id);
    out.push(rec);
  };

  // From actionable rule failures/warnings
  for (const r of ruleResults) {
    if (r.status === "PASS" || !r.action) continue;
    push({
      id: `rec-rule-${r.ruleId}-${r.meta?.eventId ?? r.meta?.habitId ?? r.meta?.goalId ?? r.action}`,
      module: r.module,
      title: actionTitle(r.action),
      description: r.description,
      action: r.action,
      target: r.target ?? null,
      reason: r.ruleId,
    });
  }

  if (input.context === "personal" && input.personal) {
    const p = input.personal;

    if (p.habits.pending.length > 0) {
      const first = p.habits.pending[0]!;
      push({
        id: `rec-habit-${first.id}`,
        module: "habitos",
        title: "Concluir hábito",
        description: first.titulo,
        action: "concluir_habito",
        target: "/dashboard/saude",
        reason: "pending_habit",
      });
    }

    if (
      !p.health.workoutToday &&
      (p.health.daysSinceLastWorkout != null || p.health.mealsToday > 0)
    ) {
      push({
        id: "rec-train-today",
        module: "saude",
        title: "Treinar hoje",
        description: "Nenhum treino registrado para hoje",
        action: "registrar_treino",
        target: "/dashboard/saude",
        reason: "workout_pending",
      });
    }

    const nearGoal = p.goals.items.find((g) => g.remainingDays <= 14);
    if (nearGoal) {
      push({
        id: `rec-goal-${nearGoal.id}`,
        module: "objetivos",
        title: "Atualizar objetivo",
        description: nearGoal.titulo,
        action: "atualizar_objetivo",
        target: "/dashboard/metas",
        reason: "goal_near",
      });
    }

    if (
      p.finance.budgetAlert ||
      (p.finance.orcamentoPct != null && p.finance.orcamentoPct >= 70)
    ) {
      push({
        id: "rec-review-budget",
        module: "financeiro",
        title: "Revisar orçamento",
        description:
          p.finance.orcamentoPct != null
            ? `${p.finance.orcamentoPct}% do orçamento usado`
            : "Alerta de despesas ativo",
        action: "revisar_orcamento",
        target: "/dashboard/financeiro",
        reason: "budget_pressure",
      });
    }

    if (p.language.configured && !p.language.practicedToday) {
      push({
        id: "rec-study-english",
        module: "idiomas",
        title: "Estudar inglês",
        description: p.language.modoLabel ?? "Prática diária pendente",
        action: "estudar_ingles",
        target: "/dashboard/idiomas",
        reason: "language_due",
      });
    }

    if (p.expertBrain.pending > 0) {
      push({
        id: "rec-process-docs",
        module: "expert_brain",
        title: "Processar documentos",
        description: `${p.expertBrain.pending} na fila`,
        action: "processar_documentos",
        target: "/dashboard/expert-brain",
        reason: "queue_pending",
      });
    }

    if (
      p.travel.trip &&
      p.travel.trip.daysRemaining <= 14 &&
      p.travel.trip.checklistPct < 100
    ) {
      push({
        id: `rec-trip-${p.travel.trip.id}`,
        module: "viagens",
        title: "Atualizar checklist da viagem",
        description: p.travel.trip.nextChecklist ?? p.travel.trip.titulo,
        action: "preparar_viagem",
        target: "/dashboard/viagens",
        reason: "trip_checklist",
      });
    }
  }

  if (input.context === "workspace" && input.workspace) {
    const w = input.workspace;
    if (w.followUpsPending > 0) {
      push({
        id: "rec-ws-followup",
        module: "workspace",
        title: "Fazer follow-up",
        description: `${w.followUpsPending} pendente(s)`,
        action: "fazer_followup",
        target: "/dashboard",
        reason: "workspace_followup",
      });
    }
    if (w.estoqueAlerts > 0) {
      push({
        id: "rec-ws-estoque",
        module: "workspace",
        title: "Revisar estoque",
        description: `${w.estoqueAlerts} alerta(s)`,
        action: "revisar_estoque",
        target: "/dashboard",
        reason: "workspace_estoque",
      });
    }
  }

  return out;
}

function actionTitle(action: string): string {
  const map: Record<string, string> = {
    registrar_despesa: "Registrar despesa",
    revisar_orcamento: "Revisar orçamento",
    concluir_habito: "Concluir hábito",
    registrar_treino: "Treinar hoje",
    atualizar_objetivo: "Atualizar objetivo",
    estudar_ingles: "Estudar inglês",
    processar_documentos: "Processar documentos",
    preparar_viagem: "Preparar viagem",
    resolver_evento: "Resolver evento atrasado",
    revisar_agenda: "Revisar agenda",
    revisar_erros: "Revisar erros do Expert Brain",
    acompanhar_fila: "Acompanhar fila",
    revisar_estoque: "Revisar estoque",
    fazer_followup: "Fazer follow-up",
    revisar_propostas: "Revisar propostas",
  };
  return map[action] ?? action.replace(/_/g, " ");
}
