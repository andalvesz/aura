/**
 * Derived insights — only from present data, never invented.
 */

import type {
  AuraIntelligenceInput,
  IntelligenceInsight,
} from "@/lib/intelligence/types";

export function buildInsights(
  input: AuraIntelligenceInput
): IntelligenceInsight[] {
  const insights: IntelligenceInsight[] = [];

  if (input.context === "personal" && input.personal) {
    const p = input.personal;

    if (p.finance.gastoMes > 0) {
      insights.push({
        id: "insight-month-spend",
        module: "financeiro",
        kind: "maior_gasto_periodo",
        title: "Gasto do mês",
        description: "Total de despesas no mês corrente",
        value: p.finance.gastoMes,
      });
    }

    if (p.finance.topCategory) {
      insights.push({
        id: "insight-top-category",
        module: "financeiro",
        kind: "maior_categoria",
        title: "Maior categoria de gasto",
        description: p.finance.topCategory.key,
        value: p.finance.topCategory.total,
      });
    }

    if (p.habits.streakDays > 0) {
      insights.push({
        id: "insight-habit-streak",
        module: "habitos",
        kind: "melhor_sequencia_habitos",
        title: "Melhor sequência de hábitos",
        description: `${p.habits.streakDays} dia(s) consecutivos`,
        value: p.habits.streakDays,
      });
    }

    if (p.goals.items.length > 0) {
      const nearest = [...p.goals.items].sort(
        (a, b) => a.remainingDays - b.remainingDays
      )[0]!;
      insights.push({
        id: "insight-nearest-goal",
        module: "objetivos",
        kind: "meta_mais_proxima",
        title: "Meta mais próxima",
        description: nearest.titulo,
        value: nearest.remainingDays,
      });
    }

    const weekLoad =
      p.agenda.next7Days.length + p.agenda.today.length + p.agenda.overdue.length;
    if (weekLoad > 0) {
      insights.push({
        id: "insight-busy-week",
        module: "calendario",
        kind: "semana_carregada",
        title: "Semana mais carregada",
        description: `${weekLoad} evento(s) no radar (hoje + 7 dias + atrasados)`,
        value: weekLoad,
      });
    }

    if (p.health.daysSinceLastWorkout != null) {
      insights.push({
        id: "insight-workout-gap",
        module: "saude",
        kind: "tempo_medio_entre_treinos",
        title: "Intervalo desde o último treino",
        description: `${p.health.daysSinceLastWorkout} dia(s)`,
        value: p.health.daysSinceLastWorkout,
      });
    }

    if (p.expertBrain.documents > 0) {
      insights.push({
        id: "insight-expert-volume",
        module: "expert_brain",
        kind: "volume_documentos",
        title: "Volume de documentos processados",
        description: `${p.expertBrain.documents} documento(s) prontos`,
        value: p.expertBrain.documents,
      });
    }

    if (p.language.configured && p.language.streak > 0) {
      insights.push({
        id: "insight-lang-streak",
        module: "idiomas",
        kind: "sequencia_idioma",
        title: "Sequência de idiomas",
        description: `${p.language.streak} dia(s)`,
        value: p.language.streak,
      });
    }

    if (p.travel.trip) {
      insights.push({
        id: "insight-trip-countdown",
        module: "viagens",
        kind: "viagem_countdown",
        title: "Próxima viagem",
        description: p.travel.trip.titulo,
        value: p.travel.trip.daysRemaining,
      });
    }
  }

  if (input.context === "workspace" && input.workspace) {
    const w = input.workspace;
    if (w.openPropostas > 0) {
      insights.push({
        id: "insight-ws-propostas",
        module: "workspace",
        kind: "propostas_abertas",
        title: "Propostas em aberto",
        description: w.workspaceName,
        value: w.openPropostas,
      });
    }
    if (w.upcomingEvents > 0) {
      insights.push({
        id: "insight-ws-events",
        module: "workspace",
        kind: "eventos_workspace",
        title: "Eventos do workspace",
        description: `${w.upcomingEvents} próximo(s)`,
        value: w.upcomingEvents,
      });
    }
  }

  return insights;
}
