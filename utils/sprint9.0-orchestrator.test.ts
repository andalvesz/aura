/**
 * Sprint 9.0 — Aura Brain Operating System (Orchestrator) tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildAuraHome,
  buildGlobalContext,
  buildGlobalTimeline,
  buildSmartLinks,
  clearOrchestratorCache,
  clearOrchestratorSessions,
  cacheGet,
  cacheSet,
  crossNavFrom,
  emptyGlobalContextSlice,
  formatWithPersonality,
  getOrchestratorSession,
  isCommandLikeQuery,
  listCommandSuggestions,
  mapLegacyTimelineKind,
  mergeTimelineSources,
  moduleHref,
  normalizePersonality,
  parseCommandIntent,
  parseNaturalSearchQuery,
  prioritizeHomeWidgets,
  resolveSearchQueryForIndex,
  setActiveProject,
  setPersonality,
  setSessionFocus,
  switchWorkspaceContext,
} from "@/lib/orchestrator";

beforeEach(() => {
  clearOrchestratorSessions();
  clearOrchestratorCache();
});

describe("Sprint 9.0 Orchestrator", () => {
  test("orchestrator layer exists without parallel engines", () => {
    assert.ok(existsSync(join(process.cwd(), "lib/orchestrator/index.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/orchestrator/context-builder.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/planner/index.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/agent-runtime/index.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/aura-brain/index.ts")));
    assert.ok(
      existsSync(join(process.cwd(), "reports/sprint9.0-aura-operating-system.md"))
    );
  });

  test("Context Builder answers operating questions", () => {
    const ctx = buildGlobalContext({
      slice: {
        user: { id: "u1", label: "Anderson" },
        workspace: { id: "personal", label: "Pessoal" },
        activeProject: { id: "p1", label: "Aura OS" },
        activeMission: { id: "m1", label: "Lançar OS" },
        activePlan: { id: "pl1", label: "Sprint 9" },
        priorities: [{ id: "pr1", label: "Ship orchestrator" }],
        activeAgents: [{ id: "a1", label: "Daily Organizer" }],
        automations: [{ id: "au1", label: "Digest diário" }],
        risks: [{ id: "r1", label: "Build quebrado" }],
        opportunities: [{ id: "o1", label: "Cross-nav" }],
      },
      session: { contextMode: "personal", projectId: "p1" },
    });

    assert.equal(ctx.answers.whoIsTheUser, "Anderson");
    assert.equal(ctx.answers.whichWorkspace, "Pessoal");
    assert.equal(ctx.answers.whichActiveProject, "Aura OS");
    assert.equal(ctx.answers.whichMission, "Lançar OS");
    assert.equal(ctx.answers.whichPlan, "Sprint 9");
    assert.deepEqual(ctx.answers.whichPriorities, ["Ship orchestrator"]);
    assert.deepEqual(ctx.answers.whichActiveAgents, ["Daily Organizer"]);
    assert.deepEqual(ctx.answers.whichAutomations, ["Digest diário"]);
    assert.deepEqual(ctx.answers.whichRisks, ["Build quebrado"]);
    assert.deepEqual(ctx.answers.whichOpportunities, ["Cross-nav"]);
    assert.equal(ctx.readOnly, true);
    assert.ok(ctx.dataCompleteness.score > 50);
  });

  test("empty context reports gaps", () => {
    const ctx = buildGlobalContext({ slice: emptyGlobalContextSlice() });
    assert.ok(ctx.dataCompleteness.gaps.includes("no_user"));
    assert.equal(ctx.answers.whichActiveProject, "Nenhum projeto ativo");
  });

  test("Global Timeline merges module sources", () => {
    const timeline = mergeTimelineSources({
      memories: [
        {
          id: "1",
          source: "memory",
          title: "Memória A",
          at: "2026-07-30T10:00:00.000Z",
        },
      ],
      plans: [
        {
          id: "2",
          source: "plan",
          title: "Plano B",
          at: "2026-07-31T10:00:00.000Z",
        },
      ],
      agents: [
        {
          id: "3",
          source: "agent",
          title: "Agente C",
          at: "2026-07-29T10:00:00.000Z",
        },
      ],
      limit: 10,
    });
    assert.equal(timeline[0].title, "Plano B");
    assert.equal(timeline.length, 3);
    assert.equal(mapLegacyTimelineKind("insight"), "insight");
    assert.equal(mapLegacyTimelineKind("promotion"), "discovery");
  });

  test("buildGlobalTimeline sorts desc", () => {
    const t = buildGlobalTimeline(
      [
        { id: "a", source: "decision", title: "Old", at: "2026-01-01T00:00:00Z" },
        { id: "b", source: "recommendation", title: "New", at: "2026-07-01T00:00:00Z" },
      ],
      5
    );
    assert.equal(t[0].title, "New");
  });

  test("Search V2 parses natural language", () => {
    const disney = parseNaturalSearchQuery("documentos sobre Disney");
    assert.ok(disney.entityHints.includes("document"));
    assert.ok(disney.topicHints.some((t) => /disney/i.test(t)));
    assert.equal(disney.filter, "aura");

    const projects = parseNaturalSearchQuery("projetos ativos");
    assert.ok(projects.entityHints.includes("project"));
    assert.ok(projects.statusHints.includes("active"));

    const ideas = parseNaturalSearchQuery("ideias de negócio");
    assert.ok(ideas.entityHints.includes("idea"));

    const resolved = resolveSearchQueryForIndex("documentos sobre Disney");
    assert.match(resolved.query, /disney/i);
    assert.equal(resolved.filter, "aura");
  });

  test("Command Palette V2 understands imperative queries", () => {
    assert.equal(parseCommandIntent("abrir projeto").kind, "open_project");
    assert.equal(parseCommandIntent("mostrar riscos").kind, "show_risks");
    assert.equal(parseCommandIntent("abrir discovery").kind, "open_discovery");
    assert.equal(parseCommandIntent("criar memória").kind, "create_memory");
    assert.equal(parseCommandIntent("executar plano").kind, "execute_plan");
    assert.equal(parseCommandIntent("abrir agente").kind, "open_agent");
    assert.equal(parseCommandIntent("procurar documento").kind, "search_document");
    assert.ok(isCommandLikeQuery("abrir projeto"));
    assert.ok(listCommandSuggestions("plano").length >= 1);
  });

  test("Session + workspace context switch resets focus", () => {
    setSessionFocus("u1", {
      projectId: "p1",
      missionId: "m1",
      planId: "pl1",
      businessId: "b1",
      contextMode: "workspace",
      workspaceId: "ws1",
    });
    const after = switchWorkspaceContext("u1", {
      contextMode: "personal",
      workspaceId: null,
      resetFocus: true,
    });
    assert.equal(after.focus.contextMode, "personal");
    assert.equal(after.focus.projectId, null);
    assert.equal(after.focus.missionId, null);
    assert.equal(after.focus.planId, null);

    setActiveProject("u1", "p2");
    assert.equal(getOrchestratorSession("u1").focus.projectId, "p2");
  });

  test("Smart Links bucket related items", () => {
    const bundle = buildSmartLinks({
      focusTitle: "Disney park ops",
      focusTags: ["disney"],
      candidates: [
        {
          id: "d1",
          kind: "knowledge",
          title: "Doc Disney",
          href: "/dashboard/knowledge/d1",
          tags: ["disney"],
        },
        {
          id: "m1",
          kind: "memory",
          title: "Viagem Disney",
          href: "/dashboard/settings/memory",
          tags: ["disney"],
        },
        {
          id: "x1",
          kind: "plan",
          title: "Plano genérico",
          href: "/dashboard/plans/x1",
          tags: ["outro"],
        },
      ],
    });
    assert.ok(bundle.documents.length >= 1 || bundle.knowledge.length >= 1);
    assert.ok(bundle.memories.length >= 1);
  });

  test("Cross navigation links modules", () => {
    const fromPlanner = crossNavFrom("planner");
    assert.ok(fromPlanner.some((l) => l.toModule === "agent-runtime"));
    assert.equal(moduleHref("discovery"), "/dashboard/discovery");
  });

  test("Dynamic dashboard never hides widgets", () => {
    const ctx = buildGlobalContext({
      slice: {
        risks: [{ id: "r", label: "risco" }],
        activeAgents: [{ id: "a", label: "agente" }],
        activeProject: { id: "p", label: "proj" },
      },
    });
    const order = prioritizeHomeWidgets(ctx);
    assert.ok(order.every((w) => w.visible === true));
    assert.ok(order.length >= 10);
    const alerts = order.find((w) => w.id === "alerts");
    const baseAlerts = prioritizeHomeWidgets(
      buildGlobalContext({ slice: emptyGlobalContextSlice() })
    ).find((w) => w.id === "alerts");
    assert.ok((alerts?.score ?? 0) > (baseAlerts?.score ?? 0));
  });

  test("Aura Home model composes OS surface", () => {
    const home = buildAuraHome({
      slice: {
        user: { id: "u", label: "Você" },
        workspace: { id: "personal", label: "Pessoal" },
        nextActions: [{ id: "n1", label: "Aprovar plano" }],
      },
      timelineEvents: [
        {
          id: "t1",
          source: "discovery",
          title: "Achado",
          at: "2026-07-31T12:00:00Z",
        },
      ],
    });
    assert.equal(home.title, "Aura Home");
    assert.ok(home.quickActions.length >= 4);
    assert.ok(home.widgetOrder.length >= 8);
    assert.equal(home.timeline[0].title, "Achado");
  });

  test("Personality does not touch Identity Engine", () => {
    const p = normalizePersonality({
      tone: "coach",
      language: "en",
      style: "mentor",
      objectives: ["crescer"],
    });
    assert.equal(p.tone, "coach");
    assert.equal(p.language, "en");
    const msg = formatWithPersonality("Foque no próximo passo.", p);
    assert.match(msg, /Vamos juntos/);
    setPersonality("u1", p);
    assert.equal(getOrchestratorSession("u1").personality.tone, "coach");
    assert.ok(existsSync(join(process.cwd(), "lib/identity/index.ts")));
  });

  test("Cache get/set with TTL", () => {
    cacheSet("k", { ok: true }, 5_000);
    assert.deepEqual(cacheGet("k"), { ok: true });
    clearOrchestratorCache();
    assert.equal(cacheGet("k"), null);
  });
});
