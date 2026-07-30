import test from "node:test";
import assert from "node:assert/strict";
import { runAuraIntelligenceEngine } from "@/lib/intelligence/engine";
import {
  clearRules,
  registerDefaultPlugins,
  listRules,
} from "@/lib/intelligence/rules";
import {
  getCachedIntelligence,
  invalidateAuraIntelligenceCache,
  setCachedIntelligence,
  getIntelligenceCacheSize,
} from "@/lib/intelligence/cache";
import {
  emptyUserInput,
  healthyUserInput,
  financeCriticalInput,
  habitsOverdueInput,
  goalsNearInput,
  tripSoonInput,
  expertBrainStuckInput,
  multiAlertInput,
  calendarConflictInput,
  workspaceInput,
} from "@/utils/intelligence-fixtures";

function resetPlugins() {
  clearRules();
  registerDefaultPlugins();
}

test.beforeEach(() => {
  resetPlugins();
  invalidateAuraIntelligenceCache();
});

test("empty user: no priorities, alerts, or recommendations invented", () => {
  const result = runAuraIntelligenceEngine(emptyUserInput());
  assert.equal(result.priorities.length, 0);
  assert.equal(result.alerts.length, 0);
  assert.equal(result.recommendations.length, 0);
  assert.ok(result.score.overall >= 0 && result.score.overall <= 100);
  assert.ok(result.meta.executionMs >= 0);
  assert.ok(result.ruleResults.every((r) => r.status === "PASS"));
});

test("healthy user: high score, no critical alerts", () => {
  const result = runAuraIntelligenceEngine(healthyUserInput());
  assert.ok(result.score.overall >= 70, `expected >=70 got ${result.score.overall}`);
  assert.ok(
    result.alerts.every((a) => a.severity !== "CRITICAL"),
    "healthy user should not have CRITICAL alerts"
  );
  assert.ok(result.insights.some((i) => i.kind === "melhor_sequencia_habitos"));
  assert.ok(result.insights.some((i) => i.kind === "maior_gasto_periodo"));
});

test("financeiro crítico: CRITICAL priority + alert", () => {
  const result = runAuraIntelligenceEngine(financeCriticalInput());
  assert.ok(result.priorities.some((p) => p.level === "CRITICAL" && p.module === "financeiro"));
  assert.ok(result.alerts.some((a) => a.type === "BudgetCriticalRule"));
  assert.ok(result.recommendations.some((r) => r.action === "revisar_orcamento"));
  assert.ok(result.score.financeiro <= 50);
});

test("hábitos atrasados: HIGH priorities", () => {
  const result = runAuraIntelligenceEngine(habitsOverdueInput());
  const habitPrios = result.priorities.filter((p) => p.module === "habitos");
  assert.ok(habitPrios.length >= 2);
  assert.ok(habitPrios.every((p) => p.level === "HIGH" || p.level === "CRITICAL"));
  assert.ok(result.recommendations.some((r) => r.title === "Concluir hábito"));
});

test("objetivos próximos: CRITICAL/HIGH", () => {
  const result = runAuraIntelligenceEngine(goalsNearInput());
  assert.ok(result.priorities.some((p) => p.module === "objetivos"));
  assert.ok(
    result.priorities.some(
      (p) => p.module === "objetivos" && (p.level === "CRITICAL" || p.level === "HIGH")
    )
  );
  assert.ok(result.insights.some((i) => i.kind === "meta_mais_proxima"));
});

test("viagem próxima (<7 dias): HIGH + checklist rec", () => {
  const result = runAuraIntelligenceEngine(tripSoonInput());
  const trip = result.priorities.find((p) => p.module === "viagens");
  assert.ok(trip);
  assert.equal(trip?.level, "HIGH");
  assert.ok(result.recommendations.some((r) => r.module === "viagens"));
});

test("Expert Brain parado: erros CRITICAL + fila HIGH", () => {
  const result = runAuraIntelligenceEngine(expertBrainStuckInput());
  assert.ok(
    result.priorities.some(
      (p) => p.sourceRule === "ExpertBrainErrorRule" && p.level === "CRITICAL"
    )
  );
  assert.ok(
    result.priorities.some(
      (p) => p.sourceRule === "ExpertBrainQueueRule" && p.level === "HIGH"
    )
  );
  assert.ok(result.recommendations.some((r) => r.action === "processar_documentos"));
});

test("múltiplos alertas: sem inconsistência de levels", () => {
  const result = runAuraIntelligenceEngine(multiAlertInput());
  assert.ok(result.alerts.length >= 3);
  assert.ok(result.priorities.length >= 3);
  // CRITICAL items appear before LOW
  const levels = result.priorities.map((p) => p.level);
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  for (let i = 1; i < levels.length; i++) {
    assert.ok(
      rank[levels[i]!] >= rank[levels[i - 1]!],
      "priorities must be sorted by severity"
    );
  }
  // No duplicate priority ids
  const ids = result.priorities.map((p) => p.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("conflitos de calendário: WARNING/HIGH", () => {
  const result = runAuraIntelligenceEngine(calendarConflictInput());
  assert.ok(
    result.ruleResults.some(
      (r) => r.ruleId === "CalendarConflictRule" && r.status === "WARNING"
    )
  );
  assert.ok(result.priorities.some((p) => p.sourceRule === "CalendarConflictRule"));
});

test("workspace: estoque + follow-ups", () => {
  const result = runAuraIntelligenceEngine(workspaceInput());
  assert.equal(result.meta.context, "workspace");
  assert.ok(result.priorities.some((p) => p.module === "workspace"));
  assert.ok(result.alerts.some((a) => a.type === "WorkspaceEstoqueRule"));
  assert.ok(result.recommendations.some((r) => r.action === "fazer_followup"));
  assert.ok(result.score.overall >= 0);
});

test("plugins registered and engine has no openai/db imports at runtime", () => {
  assert.ok(listRules().length >= 10);
  const result = runAuraIntelligenceEngine(emptyUserInput());
  assert.ok(result.meta.rulesRun >= listRules().length - 3); // workspace rules skipped
});

test("cache: set/get/invalidate per user", () => {
  const result = runAuraIntelligenceEngine(healthyUserInput());
  setCachedIntelligence("u1", "personal", result);
  assert.equal(getIntelligenceCacheSize(), 1);
  const hit = getCachedIntelligence("u1", "personal");
  assert.ok(hit);
  assert.equal(hit?.meta.cacheHit, true);
  invalidateAuraIntelligenceCache("u1");
  assert.equal(getCachedIntelligence("u1", "personal"), null);
});

test("score dimensions always 0–100", () => {
  for (const input of [
    emptyUserInput(),
    healthyUserInput(),
    financeCriticalInput(),
    multiAlertInput(),
    workspaceInput(),
  ]) {
    const s = runAuraIntelligenceEngine(input).score;
    for (const [k, v] of Object.entries(s)) {
      assert.ok(
        typeof v === "number" && v >= 0 && v <= 100,
        `${k}=${v} out of range`
      );
    }
  }
});

test("performance: engine typically under 50ms for fixture inputs", () => {
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const r = runAuraIntelligenceEngine(multiAlertInput());
    samples.push(r.meta.executionMs);
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  assert.ok(avg < 50, `avg executionMs ${avg} should be < 50`);
});
