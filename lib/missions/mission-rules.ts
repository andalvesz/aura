/**
 * Mission rules — risks, dependencies, modules, safe automations.
 */

import type {
  Mission,
  MissionDependency,
  MissionModuleId,
  MissionRecommendation,
  MissionRisk,
  MissionRiskLevel,
  MissionSuggestedAction,
  MissionTask,
} from "@/lib/missions/mission-types";

const RISK_RANK: Record<MissionRiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function isAutoExecutableRisk(level: MissionRiskLevel): boolean {
  return level === "LOW";
}

export function collectInvolvedModules(mission: Pick<Mission, "phases" | "tasks" | "modules">): MissionModuleId[] {
  const set = new Set<MissionModuleId>(mission.modules);
  for (const p of mission.phases) {
    for (const m of p.moduleIds) set.add(m);
  }
  for (const t of mission.tasks) set.add(t.moduleId);
  return [...set];
}

/**
 * Infer linear dependencies from task titles / phase order.
 * Example: "Comprar passagem" depends on "Economizar dinheiro" depends on "Definir meta financeira".
 */
export function detectDependencies(
  missionId: string,
  tasks: MissionTask[]
): MissionDependency[] {
  const deps: MissionDependency[] = [];
  const byTitle = new Map(tasks.map((t) => [normalizeTitle(t.title), t]));

  const chains: [string, string, string][] = [
    ["comprar passagem", "economizar dinheiro", "Passagem depende de economia"],
    ["economizar dinheiro", "definir meta financeira", "Economia depende da meta"],
    ["reservar hospedagem", "economizar dinheiro", "Hospedagem depende de economia"],
    ["executar experimento", "escrever hipoteses", "Experimento depende de hipóteses"],
    ["executar experimento", "planejar experimento", "Execução depende do plano"],
    ["rascunhar modelo de receita", "analisar resultado", "Modelo após validação"],
    ["praticar conversacao", "criar habito de estudo", "Speaking após rotina"],
    ["agendar treinos", "criar plano de treino", "Agenda após plano"],
    ["reduzir gasto critico", "criar meta financeira", "Corte após meta"],
    ["alocar recursos", "acompanhar progresso da meta", "Alocação após progresso"],
  ];

  for (const [from, to, reason] of chains) {
    const fromTask = byTitle.get(from);
    const toTask = byTitle.get(to);
    if (!fromTask || !toTask) continue;
    deps.push({
      id: `dep-${missionId.slice(0, 8)}-${fromTask.id}-${toTask.id}`,
      missionId,
      fromTaskId: fromTask.id,
      toTaskId: toTask.id,
      reason,
    });
  }

  // Phase-order fallback: first pending task in phase N+1 depends on last task of phase N
  const byPhase = new Map<string, MissionTask[]>();
  for (const t of tasks) {
    const list = byPhase.get(t.phaseId) ?? [];
    list.push(t);
    byPhase.set(t.phaseId, list);
  }

  return deps;
}

export function applyDependencyBlocks(
  tasks: MissionTask[],
  deps: MissionDependency[]
): MissionTask[] {
  const blockedBy = new Map<string, string[]>();
  for (const d of deps) {
    const list = blockedBy.get(d.fromTaskId) ?? [];
    list.push(d.toTaskId);
    blockedBy.set(d.fromTaskId, list);
  }

  const done = new Set(tasks.filter((t) => t.status === "done").map((t) => t.id));

  return tasks.map((t) => {
    const blockers = blockedBy.get(t.id) ?? [];
    const openBlockers = blockers.filter((id) => !done.has(id));
    if (openBlockers.length === 0) {
      return { ...t, blockedBy: blockers, status: t.status === "blocked" ? "pending" : t.status };
    }
    if (t.status === "done" || t.status === "cancelled") {
      return { ...t, blockedBy: blockers };
    }
    return { ...t, blockedBy: blockers, status: "blocked" };
  });
}

export function detectRuntimeRisks(mission: Mission, asOf: Date): MissionRisk[] {
  const risks = [...mission.risks];
  const openTasks = mission.tasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const blocked = openTasks.filter((t) => t.status === "blocked");
  const highOpen = openTasks.filter((t) => RISK_RANK[t.riskLevel] >= RISK_RANK.HIGH);

  if (blocked.length >= 2) {
    risks.push({
      id: `risk-blocked-${mission.id.slice(0, 8)}`,
      missionId: mission.id,
      title: "Múltiplas tarefas bloqueadas",
      description: `${blocked.length} tarefas aguardam dependências`,
      level: "HIGH",
      status: "open",
      relatedTaskIds: blocked.map((t) => t.id),
      mitigation: "Resolver dependências críticas primeiro",
    });
  }

  if (mission.targetDate) {
    const remaining = daysBetween(asOf, new Date(mission.targetDate));
    const pct = mission.progress.totalPct;
    if (remaining <= 14 && pct < 50) {
      risks.push({
        id: `risk-deadline-${mission.id.slice(0, 8)}`,
        missionId: mission.id,
        title: "Prazo apertado",
        description: `${remaining} dias restantes com ${pct}% concluído`,
        level: remaining <= 7 ? "CRITICAL" : "HIGH",
        status: "open",
        relatedTaskIds: [],
        mitigation: "Repriorizar ou estender prazo",
      });
    }
  }

  if (highOpen.length > 0 && mission.status === "ACTIVE") {
    risks.push({
      id: `risk-high-tasks-${mission.id.slice(0, 8)}`,
      missionId: mission.id,
      title: "Ações de alto risco pendentes",
      description: "Exigem confirmação — nunca execução automática",
      level: "HIGH",
      status: "open",
      relatedTaskIds: highOpen.map((t) => t.id),
      mitigation: "Revisar e confirmar manualmente",
    });
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return risks.filter((r) => {
    if (seen.has(r.title)) return false;
    seen.add(r.title);
    return true;
  });
}

export function buildRecommendations(mission: Mission): MissionRecommendation[] {
  const recs: MissionRecommendation[] = [];
  const next = mission.tasks.find(
    (t) => t.status === "pending" || t.status === "in_progress"
  );
  if (next) {
    const auto = isAutoExecutableRisk(next.riskLevel);
    recs.push({
      id: `rec-next-${next.id}`,
      missionId: mission.id,
      title: `Avançar: ${next.title}`,
      description: next.description,
      actionId: auto ? "create_mission_reminder" : "create_notification",
      riskLevel: next.riskLevel,
      moduleId: next.moduleId,
      reason: "Próxima tarefa desbloqueada da missão",
      autoExecutable: auto,
    });
  }

  const openRisk = mission.risks.find((r) => r.status === "open" && RISK_RANK[r.level] >= RISK_RANK.HIGH);
  if (openRisk) {
    recs.push({
      id: `rec-risk-${openRisk.id}`,
      missionId: mission.id,
      title: `Mitigar risco: ${openRisk.title}`,
      description: openRisk.mitigation,
      actionId: "create_notification",
      riskLevel: openRisk.level,
      moduleId: "planner",
      reason: "Risco aberto na missão",
      autoExecutable: false,
    });
  }

  if (mission.type === "BUSINESS" && mission.business) {
    if (mission.business.hypotheses.length === 0) {
      recs.push({
        id: `rec-hyp-${mission.id.slice(0, 8)}`,
        missionId: mission.id,
        title: "Formular hipóteses de negócio",
        description: "Gerar rascunhos — nunca criar empresa",
        actionId: "create_business_idea_draft",
        riskLevel: "LOW",
        moduleId: "business_lab",
        reason: "Missão BUSINESS sem hipóteses",
        autoExecutable: false,
      });
    }
  }

  return recs;
}

export function buildSuggestedActions(mission: Mission): MissionSuggestedAction[] {
  return mission.recommendations.map((r) => ({
    id: `act-${r.id}`,
    missionId: mission.id,
    title: r.title,
    reason: r.reason,
    actionId: r.actionId ?? "create_notification",
    riskLevel: r.riskLevel,
    autoExecutable: r.autoExecutable && isAutoExecutableRisk(r.riskLevel),
    input: {
      missionId: mission.id,
      title: r.title,
      message: r.description,
      related_module: "missions",
      related_id: mission.id,
    },
  }));
}

/** Only LOW-risk proposals may enter automation queue */
export function filterSafeAutomationProposals(
  actions: MissionSuggestedAction[]
): MissionSuggestedAction[] {
  return actions.filter((a) => a.autoExecutable && isAutoExecutableRisk(a.riskLevel));
}

export function inferStatusFromProgress(mission: Mission, asOf: Date): Mission["status"] {
  if (mission.status === "ARCHIVED" || mission.status === "PAUSED") return mission.status;
  if (mission.progress.totalPct >= 100) return "COMPLETED";
  const blockedTasks = mission.tasks.filter((t) => t.status === "blocked");
  const openCritical = mission.risks.some(
    (r) => r.status === "open" && r.level === "CRITICAL"
  );
  if (openCritical || (blockedTasks.length > 0 && mission.progress.totalPct < 10)) {
    return "BLOCKED";
  }
  if (mission.status === "PLANNING" && mission.tasks.some((t) => t.status !== "pending")) {
    return "ACTIVE";
  }
  if (mission.status === "PLANNING") {
    const ageDays = daysBetween(new Date(mission.createdAt), asOf);
    if (ageDays >= 1) return "ACTIVE";
  }
  return mission.status === "COMPLETED" ? "COMPLETED" : mission.status === "BLOCKED" ? "BLOCKED" : mission.status === "ACTIVE" ? "ACTIVE" : mission.status;
}

function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
