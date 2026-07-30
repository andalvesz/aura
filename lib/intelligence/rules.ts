/**
 * Rules plugin registry — modules register rules; engine only executes.
 */

import type {
  AuraIntelligenceInput,
  IntelligenceRule,
  RuleResult,
} from "@/lib/intelligence/types";

const registry = new Map<string, IntelligenceRule>();

export function registerRule(rule: IntelligenceRule): void {
  registry.set(rule.id, rule);
}

export function registerRules(rules: IntelligenceRule[]): void {
  for (const rule of rules) registerRule(rule);
}

export function clearRules(): void {
  registry.clear();
}

export function listRules(): IntelligenceRule[] {
  return [...registry.values()];
}

export function getRulesForContext(
  context: AuraIntelligenceInput["context"]
): IntelligenceRule[] {
  const all = listRules();
  if (context === "workspace") {
    return all.filter(
      (r) => r.module === "workspace" || r.module === "sistema"
    );
  }
  return all.filter((r) => r.module !== "workspace");
}

export function evaluateRules(
  input: AuraIntelligenceInput,
  rules?: IntelligenceRule[]
): RuleResult[] {
  const selected = rules ?? getRulesForContext(input.context);
  const results: RuleResult[] = [];
  for (const rule of selected) {
    const out = rule.evaluate(input);
    if (!out) continue;
    if (Array.isArray(out)) results.push(...out);
    else results.push(out);
  }
  return results;
}

function pass(
  ruleId: string,
  module: RuleResult["module"],
  title: string
): RuleResult {
  return {
    ruleId,
    module,
    status: "PASS",
    title,
    description: "OK",
    severity: "LOW",
  };
}

function warning(
  partial: Omit<RuleResult, "status"> & { status?: "WARNING" }
): RuleResult {
  return { ...partial, status: "WARNING" };
}

function fail(
  partial: Omit<RuleResult, "status"> & { status?: "FAIL" }
): RuleResult {
  return { ...partial, status: "FAIL" };
}

/* ------------------------------------------------------------------ */
/* Personal module rules                                              */
/* ------------------------------------------------------------------ */

export const BudgetCriticalRule: IntelligenceRule = {
  id: "BudgetCriticalRule",
  module: "financeiro",
  evaluate(input) {
    const f = input.personal?.finance;
    if (!f) return null;
    if (!f.hasSaldo && f.gastoMes === 0 && f.receitaMes === 0) {
      return pass(this.id, this.module, "Orçamento");
    }
    const pct = f.orcamentoPct;
    if (pct != null && pct >= 100) {
      return fail({
        ruleId: this.id,
        module: this.module,
        title: "Orçamento estourado",
        description: `${pct}% do orçamento do mês já foi usado`,
        severity: "CRITICAL",
        target: "/dashboard/financeiro",
        action: "revisar_orcamento",
        meta: { orcamentoPct: pct },
      });
    }
    if (f.budgetAlert || (pct != null && pct >= 80)) {
      return warning({
        ruleId: this.id,
        module: this.module,
        title: "Orçamento em alerta",
        description:
          pct != null
            ? `${pct}% do orçamento usado`
            : "Despesas incomuns detectadas",
        severity: "HIGH",
        target: "/dashboard/financeiro",
        action: "revisar_orcamento",
        meta: { orcamentoPct: pct },
      });
    }
    return pass(this.id, this.module, "Orçamento");
  },
};

export const OverdueEventRule: IntelligenceRule = {
  id: "OverdueEventRule",
  module: "calendario",
  evaluate(input) {
    const overdue = input.personal?.agenda.overdue ?? [];
    if (overdue.length === 0) {
      return pass(this.id, this.module, "Eventos");
    }
    return overdue.slice(0, 8).map((e) =>
      fail({
        ruleId: this.id,
        module: this.module,
        title: e.titulo,
        description: `Evento atrasado desde ${e.data}`,
        severity: "CRITICAL",
        target: "/dashboard/calendario",
        action: "resolver_evento",
        meta: { eventId: e.id, data: e.data },
      })
    );
  },
};

export const CalendarConflictRule: IntelligenceRule = {
  id: "CalendarConflictRule",
  module: "calendario",
  evaluate(input) {
    const timed = (input.personal?.agenda.timedEvents ?? []).filter(
      (e) => !isAllDayEvent(e.start, e.end)
    );
    if (timed.length < 2) {
      return pass(this.id, this.module, "Conflitos de agenda");
    }
    const conflicts: RuleResult[] = [];
    const sorted = [...timed].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      const aEnd = a.end ?? a.start;
      if (aEnd > b.start) {
        conflicts.push(
          warning({
            ruleId: this.id,
            module: this.module,
            title: "Conflito de calendário",
            description: `"${a.titulo}" e "${b.titulo}" se sobrepõem`,
            severity: "HIGH",
            target: "/dashboard/calendario",
            action: "revisar_agenda",
            meta: { eventA: a.id, eventB: b.id },
          })
        );
      }
    }
    if (conflicts.length === 0) {
      return pass(this.id, this.module, "Conflitos de agenda");
    }
    return conflicts;
  },
};

/** All-day / date-only events must not create false overlap alerts. */
function isAllDayEvent(start: string, end: string | null): boolean {
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return true;
  const midnight =
    s.getUTCHours() === 0 &&
    s.getUTCMinutes() === 0 &&
    s.getUTCSeconds() === 0;
  // Also treat pure date (YYYY-MM-DD) as all-day
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return true;
  if (!midnight) return false;
  if (!end) return true;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return true;
  const hours = (e.getTime() - s.getTime()) / 3_600_000;
  return hours >= 23;
}

export const HabitBrokenRule: IntelligenceRule = {
  id: "HabitBrokenRule",
  module: "habitos",
  evaluate(input) {
    const habits = input.personal?.habits;
    if (!habits) return null;
    const overdue = habits.pending.filter((h) => h.data < input.asOf);
    if (overdue.length === 0) {
      return pass(this.id, this.module, "Hábitos");
    }
    return overdue.slice(0, 8).map((h) =>
      fail({
        ruleId: this.id,
        module: this.module,
        title: h.titulo,
        description: `Hábito atrasado desde ${h.data}`,
        severity: "HIGH",
        target: "/dashboard/saude",
        action: "concluir_habito",
        meta: { habitId: h.id },
      })
    );
  },
};

export const WorkoutOverdueRule: IntelligenceRule = {
  id: "WorkoutOverdueRule",
  module: "saude",
  evaluate(input) {
    const h = input.personal?.health;
    if (!h) return null;
    if (h.workoutToday) {
      return pass(this.id, this.module, "Treino");
    }
    const days = h.daysSinceLastWorkout;
    // No health history → do not invent a workout alert
    if (days == null && h.mealsToday === 0) {
      return pass(this.id, this.module, "Treino");
    }
    if (days != null && days >= 3) {
      return fail({
        ruleId: this.id,
        module: this.module,
        title: "Treino atrasado",
        description: `Sem treino há ${days} dia(s)`,
        severity: "HIGH",
        target: "/dashboard/saude",
        action: "registrar_treino",
        meta: { daysSinceLastWorkout: days },
      });
    }
    return warning({
      ruleId: this.id,
      module: this.module,
      title: "Treino do dia pendente",
      description: "Nenhum treino registrado para hoje",
      severity: "MEDIUM",
      target: "/dashboard/saude",
      action: "registrar_treino",
    });
  },
};

export const GoalDeadlineRule: IntelligenceRule = {
  id: "GoalDeadlineRule",
  module: "objetivos",
  evaluate(input) {
    const goals = input.personal?.goals.items ?? [];
    if (goals.length === 0) {
      return pass(this.id, this.module, "Objetivos");
    }
    const near = goals.filter(
      (g) => g.remainingDays <= 7 || g.behind === true
    );
    if (near.length === 0) {
      return pass(this.id, this.module, "Objetivos");
    }
    return near.map((g) => {
      const critical = g.remainingDays <= 2 || g.behind === true;
      const severity = critical
        ? ("CRITICAL" as const)
        : g.remainingDays <= 3
          ? ("HIGH" as const)
          : ("MEDIUM" as const);
      return (critical ? fail : warning)({
        ruleId: this.id,
        module: this.module,
        title: g.titulo,
        description:
          g.behind === true
            ? "Meta financeira/objetivo atrás do ritmo"
            : `Prazo em ${g.remainingDays} dia(s)`,
        severity,
        target: "/dashboard/metas",
        action: "atualizar_objetivo",
        meta: {
          goalId: g.id,
          remainingDays: g.remainingDays,
        },
      });
    });
  },
};

export const TripSoonRule: IntelligenceRule = {
  id: "TripSoonRule",
  module: "viagens",
  evaluate(input) {
    const trip = input.personal?.travel.trip;
    if (!trip) {
      return pass(this.id, this.module, "Viagens");
    }
    if (trip.daysRemaining > 14) {
      return pass(this.id, this.module, "Viagens");
    }
    const critical = trip.daysRemaining <= 3;
    const soon = trip.daysRemaining <= 7;
    const severity = critical
      ? ("CRITICAL" as const)
      : soon
        ? ("HIGH" as const)
        : ("MEDIUM" as const);
    const fn = critical || soon ? (critical ? fail : warning) : warning;
    return fn({
      ruleId: this.id,
      module: this.module,
      title: trip.titulo,
      description:
        trip.daysRemaining === 0
          ? "Viagem em andamento / hoje"
          : `Viagem em ${trip.daysRemaining} dia(s) · checklist ${trip.checklistPct}%`,
      severity,
      target: "/dashboard/viagens",
      action: "preparar_viagem",
      meta: {
        tripId: trip.id,
        daysRemaining: trip.daysRemaining,
        checklistPct: trip.checklistPct,
      },
    });
  },
};

export const LanguageStreakRule: IntelligenceRule = {
  id: "LanguageStreakRule",
  module: "idiomas",
  evaluate(input) {
    const lang = input.personal?.language;
    if (!lang?.configured) {
      return pass(this.id, this.module, "Idiomas");
    }
    if (lang.practicedToday) {
      return pass(this.id, this.module, "Idiomas");
    }
    return warning({
      ruleId: this.id,
      module: this.module,
      title: "Praticar idioma",
      description: "Nenhuma prática registrada hoje",
      severity: "LOW",
      target: "/dashboard/idiomas",
      action: "estudar_ingles",
    });
  },
};

export const ExpertBrainErrorRule: IntelligenceRule = {
  id: "ExpertBrainErrorRule",
  module: "expert_brain",
  evaluate(input) {
    const ex = input.personal?.expertBrain;
    if (!ex) return null;
    if (ex.errors <= 0) {
      return pass(this.id, this.module, "Expert Brain erros");
    }
    return fail({
      ruleId: this.id,
      module: this.module,
      title: "Expert Brain com erro",
      description: `${ex.errors} item(ns) com falha de ingestão`,
      severity: "CRITICAL",
      target: "/dashboard/expert-brain",
      action: "revisar_erros",
      meta: { errors: ex.errors },
    });
  },
};

export const ExpertBrainQueueRule: IntelligenceRule = {
  id: "ExpertBrainQueueRule",
  module: "expert_brain",
  evaluate(input) {
    const ex = input.personal?.expertBrain;
    if (!ex) return null;
    if (ex.pending <= 0 && ex.processing <= 0) {
      return pass(this.id, this.module, "Expert Brain fila");
    }
    if (ex.pending > 0 && ex.processing === 0) {
      return fail({
        ruleId: this.id,
        module: this.module,
        title: "Fila parada",
        description: `${ex.pending} documento(s) pendente(s) sem processamento`,
        severity: "HIGH",
        target: "/dashboard/expert-brain",
        action: "processar_documentos",
        meta: { pending: ex.pending },
      });
    }
    return warning({
      ruleId: this.id,
      module: this.module,
      title: "Fila em processamento",
      description: `${ex.pending} pendente(s) · ${ex.processing} processando`,
      severity: "MEDIUM",
      target: "/dashboard/expert-brain",
      action: "acompanhar_fila",
      meta: { pending: ex.pending, processing: ex.processing },
    });
  },
};

/* ------------------------------------------------------------------ */
/* Workspace rules                                                    */
/* ------------------------------------------------------------------ */

export const WorkspaceEstoqueRule: IntelligenceRule = {
  id: "WorkspaceEstoqueRule",
  module: "workspace",
  evaluate(input) {
    const w = input.workspace;
    if (!w) return null;
    if (w.estoqueAlerts <= 0) {
      return pass(this.id, this.module, "Estoque");
    }
    return fail({
      ruleId: this.id,
      module: this.module,
      title: "Estoque crítico",
      description: `${w.estoqueAlerts} item(ns) com estoque crítico`,
      severity: "HIGH",
      target: "/dashboard",
      action: "revisar_estoque",
      meta: { count: w.estoqueAlerts },
    });
  },
};

export const WorkspaceFollowUpRule: IntelligenceRule = {
  id: "WorkspaceFollowUpRule",
  module: "workspace",
  evaluate(input) {
    const w = input.workspace;
    if (!w) return null;
    if (w.followUpsPending <= 0) {
      return pass(this.id, this.module, "Follow-ups");
    }
    return warning({
      ruleId: this.id,
      module: this.module,
      title: "Follow-ups pendentes",
      description: `${w.followUpsPending} lead(s) aguardando follow-up`,
      severity: "MEDIUM",
      target: "/dashboard",
      action: "fazer_followup",
      meta: { count: w.followUpsPending },
    });
  },
};

export const WorkspacePropostasRule: IntelligenceRule = {
  id: "WorkspacePropostasRule",
  module: "workspace",
  evaluate(input) {
    const w = input.workspace;
    if (!w) return null;
    if (w.openPropostas <= 0) {
      return pass(this.id, this.module, "Propostas");
    }
    return warning({
      ruleId: this.id,
      module: this.module,
      title: "Propostas em aberto",
      description: `${w.openPropostas} proposta(s)/orçamento(s) em aberto`,
      severity: "LOW",
      target: "/dashboard",
      action: "revisar_propostas",
      meta: { count: w.openPropostas },
    });
  },
};

/** Default plugin set — call once at module load */
export function registerDefaultPlugins(): void {
  registerRules([
    BudgetCriticalRule,
    OverdueEventRule,
    CalendarConflictRule,
    HabitBrokenRule,
    WorkoutOverdueRule,
    GoalDeadlineRule,
    TripSoonRule,
    LanguageStreakRule,
    ExpertBrainErrorRule,
    ExpertBrainQueueRule,
    WorkspaceEstoqueRule,
    WorkspaceFollowUpRule,
    WorkspacePropostasRule,
  ]);
}
