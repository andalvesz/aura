import test from "node:test";
import assert from "node:assert/strict";
import { runMissionEngine } from "@/lib/missions/mission-engine";
import { planMissionFromInput } from "@/lib/missions/mission-planner";
import {
  computeMissionProgress,
  enrichMission,
  pickMissionOfTheDay,
} from "@/lib/missions/mission-progress";
import {
  applyDependencyBlocks,
  detectDependencies,
  filterSafeAutomationProposals,
  isAutoExecutableRisk,
} from "@/lib/missions/mission-rules";
import {
  getMissionTemplateByType,
  resolveMissionTemplate,
} from "@/lib/missions/mission-templates";
import { clearStoredMissions } from "@/lib/missions/mission-store";
import { runAuraBrainPlanner } from "@/lib/aura-brain/planner/planner";
import { DEFAULT_AURA_BRAIN_SETTINGS } from "@/lib/aura-brain/types";
import { ensureBuiltinActions, listActions, clearActions } from "@/lib/aura-brain/actions/registry";

test.beforeEach(() => {
  clearStoredMissions();
  clearActions();
  ensureBuiltinActions();
});

test("templates cover all mission types", () => {
  const types = [
    "PERSONAL",
    "BUSINESS",
    "LEARNING",
    "HEALTH",
    "FINANCIAL",
    "TRAVEL",
    "CUSTOM",
  ] as const;
  for (const t of types) {
    const tpl = getMissionTemplateByType(t);
    assert.equal(tpl.type, t);
    assert.ok(tpl.phases.length >= 2);
    assert.ok(tpl.modules.length >= 1);
  }
});

test("disney title resolves disney template", () => {
  const tpl = resolveMissionTemplate("TRAVEL", null, "Viagem Disney 2027");
  assert.equal(tpl.id, "tpl-disney");
});

test("planner generates phases milestones tasks risks deps modules", () => {
  const mission = planMissionFromInput("user-1", {
    title: "Viajar para Europa",
    type: "TRAVEL",
  });
  assert.equal(mission.status, "PLANNING");
  assert.ok(mission.phases.length >= 3);
  assert.ok(mission.milestones.length >= 3);
  assert.ok(mission.tasks.length >= 5);
  assert.ok(mission.risks.length >= 1);
  assert.ok(mission.resources.length >= 1);
  assert.ok(mission.modules.includes("viagens"));
  assert.ok(mission.modules.includes("financeiro"));
  assert.ok(mission.progress.estimatedTotalDays > 0);
  assert.ok(mission.dependencies.length >= 1);
});

test("travel dependencies: passagem depende de economizar", () => {
  const mission = planMissionFromInput("user-1", {
    title: "Disney",
    type: "TRAVEL",
  });
  const deps = detectDependencies(mission.id, mission.tasks);
  const titles = new Map(mission.tasks.map((t) => [t.id, t.title]));
  const hasChain = deps.some((d) => {
    const from = titles.get(d.fromTaskId)?.toLowerCase() ?? "";
    const to = titles.get(d.toTaskId)?.toLowerCase() ?? "";
    return from.includes("passagem") && to.includes("economizar");
  });
  assert.equal(hasChain, true);

  const blocked = applyDependencyBlocks(mission.tasks, deps);
  const passagem = blocked.find((t) => /passagem/i.test(t.title));
  assert.ok(passagem);
  assert.equal(passagem!.status, "blocked");
  assert.ok(passagem!.blockedBy.length >= 1);
});

test("business never creates company — only drafts", () => {
  const mission = planMissionFromInput("user-1", {
    title: "Abrir empresa de IA",
    type: "BUSINESS",
  });
  assert.ok(mission.business);
  assert.ok(mission.business!.hypotheses.length >= 1);
  assert.ok(mission.business!.experiments.length >= 1);
  assert.ok(mission.business!.opportunities.length >= 1);
  assert.ok(
    mission.risks.some((r) => /empresa/i.test(r.title) || /empresa/i.test(r.mitigation))
  );
});

test("engine creates mission and computes progress score insights", () => {
  const result = runMissionEngine({
    userId: "u1",
    mode: "personal",
    create: [{ title: "Aprender inglês", type: "LEARNING", priority: 80 }],
  });
  assert.equal(result.meta.createdCount, 1);
  assert.equal(result.missions.length, 1);
  const m = result.missions[0];
  assert.equal(m.type, "LEARNING");
  assert.ok(m.score.overall >= 0 && m.score.overall <= 100);
  assert.ok(m.progress.breakdown.length >= 1);
  assert.ok(result.missionOfTheDay);
  assert.match(result.missionOfTheDay!.message, /avançará \d+% na missão/i);
  assert.ok(result.suggestedActions.length >= 1);
});

test("only LOW risk actions are auto-executable", () => {
  assert.equal(isAutoExecutableRisk("LOW"), true);
  assert.equal(isAutoExecutableRisk("MEDIUM"), false);
  assert.equal(isAutoExecutableRisk("HIGH"), false);
  assert.equal(isAutoExecutableRisk("CRITICAL"), false);

  const result = runMissionEngine({
    userId: "u1",
    mode: "personal",
    create: [{ title: "Meta financeira", type: "FINANCIAL" }],
  });
  for (const a of result.automationProposals) {
    assert.equal(a.riskLevel, "LOW");
    assert.equal(a.autoExecutable, true);
  }
  const filtered = filterSafeAutomationProposals(result.suggestedActions);
  assert.ok(filtered.every((a) => a.riskLevel === "LOW"));
});

test("progress increases when tasks complete", () => {
  let mission = planMissionFromInput("u1", {
    title: "Melhorar saúde",
    type: "HEALTH",
  });
  const before = computeMissionProgress(mission).totalPct;
  // complete all non-blocked tasks
  mission = {
    ...mission,
    tasks: mission.tasks.map((t) =>
      t.status === "blocked" ? t : { ...t, status: "done" as const }
    ),
    lastActivityAt: new Date().toISOString(),
  };
  mission = enrichMission(mission);
  assert.ok(mission.progress.totalPct > before);
});

test("mission of the day prefers active high priority", () => {
  const a = enrichMission(
    planMissionFromInput("u1", { title: "A", type: "PERSONAL", priority: 20 })
  );
  const b = enrichMission(
    planMissionFromInput("u1", { title: "B Alta", type: "HEALTH", priority: 95 })
  );
  a.status = "ACTIVE";
  b.status = "ACTIVE";
  const pick = pickMissionOfTheDay([a, b]);
  assert.ok(pick);
  assert.equal(pick!.missionTitle, "B Alta");
});

test("aura brain planner accepts mission actions", () => {
  const missionResult = runMissionEngine({
    userId: "u1",
    mode: "personal",
    create: [{ title: "Objetivo pessoal", type: "PERSONAL" }],
  });
  const planned = runAuraBrainPlanner({
    userId: "u1",
    context: "personal",
    intelligence: {
      priorities: [],
      alerts: [],
      recommendations: [],
      insights: [],
      score: {
        financeiro: 50,
        saude: 50,
        produtividade: 50,
        aprendizado: 50,
        organizacao: 50,
        consistencia: 50,
        overall: 50,
      },
    },
    settings: {
      userId: "u1",
      ...DEFAULT_AURA_BRAIN_SETTINGS,
      updatedAt: new Date().toISOString(),
    },
    missionActions: missionResult.automationProposals,
  });
  assert.ok(
    planned.proposedActions.some((p) => p.dedupeKey.startsWith("mission:")) ||
      missionResult.automationProposals.length === 0
  );
  if (missionResult.automationProposals.length > 0) {
    assert.ok(planned.plans.some((p) => p.source === "mission_engine"));
  }
});

test("action registry includes mission actions", () => {
  assert.ok(listActions().some((a) => a.id === "create_mission_reminder"));
  assert.ok(listActions().some((a) => a.id === "create_mission_task_draft"));
});
