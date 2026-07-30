/**
 * RC4.2 — Vercel production readiness (no live network required).
 * Covers: env, auth redirects, workspace isolation mirrors, Brain modules,
 * RLS visibility contracts, routes, logger safety.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  BRAIN_MIGRATIONS_RC4_2,
  PRODUCTION_ENV_REQUIREMENTS,
  PRODUCTION_ROUTE_SMOKE,
  assertProductionEnvShape,
  missingRequiredEnv,
  requiredProductionEnvKeys,
} from "@/lib/production/env-checklist";
import { prodLog } from "@/lib/production/logger";
import { safeAuthNextPath, safeDashboardPath } from "@/lib/redirect";
import {
  getPasswordRecoveryRedirectUrl,
  PRODUCTION_SITE_URL,
} from "@/lib/site-url";
import {
  canAccessPersonalRow,
  canAccessWorkspaceRow,
} from "@/lib/workspace/table-classification";
import {
  canViewDecision,
  createEmptyDecisionState,
  generateDecisionsPure,
} from "@/lib/decision-support";
import {
  canViewScenario,
  createEmptyScenarioState,
  simulateScenariosPure,
} from "@/lib/scenario";
import {
  canViewPriority,
  createEmptyPriorityState,
  generatePrioritiesPure,
} from "@/lib/prioritization";
import {
  canViewerAccess,
  DEFAULT_VISIBILITY,
} from "@/lib/aura-brain/visibility";

const root = process.cwd();

function fileExists(rel: string): boolean {
  return existsSync(join(root, rel));
}

describe("RC4.2 Env & docs", () => {
  test("required production env keys are documented", () => {
    const required = requiredProductionEnvKeys();
    assert.ok(required.includes("NEXT_PUBLIC_SUPABASE_URL"));
    assert.ok(required.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
    assert.ok(required.includes("NEXT_PUBLIC_SITE_URL"));
    assert.ok(PRODUCTION_ENV_REQUIREMENTS.length >= 8);
  });

  test("missingRequiredEnv detects gaps", () => {
    const missing = missingRequiredEnv({} as NodeJS.ProcessEnv);
    assert.equal(missing.length, 3);
    const okLocal = assertProductionEnvShape({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOi...",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NODE_ENV: "development",
    } as NodeJS.ProcessEnv);
    assert.equal(okLocal.missing.length, 0);
  });

  test("rejects localhost site url in production shape", () => {
    const res = assertProductionEnvShape({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOi...",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    assert.ok(res.warnings.some((w) => /localhost/i.test(w)));
  });

  test("deployment docs exist", () => {
    assert.ok(fileExists("docs/deployment/vercel-env.md"));
    assert.ok(fileExists("docs/deployment/go-live.md"));
    assert.ok(fileExists("docs/deployment/migrations-checklist.md"));
    assert.ok(fileExists("CHANGELOG_RC4.2.md"));
  });

  test("error / offline / forbidden pages exist", () => {
    assert.ok(fileExists("app/not-found.tsx"));
    assert.ok(fileExists("app/error.tsx"));
    assert.ok(fileExists("app/global-error.tsx"));
    assert.ok(fileExists("app/offline/page.tsx"));
    assert.ok(fileExists("app/sem-permissao/page.tsx"));
    assert.ok(fileExists("app/recuperar-senha/page.tsx"));
    assert.ok(fileExists("app/redefinir-senha/page.tsx"));
  });
});

describe("RC4.2 Auth redirects", () => {
  test("safeDashboardPath blocks open redirects", () => {
    assert.equal(safeDashboardPath("/dashboard/priorities"), "/dashboard/priorities");
    assert.equal(safeDashboardPath("https://evil.com"), "/dashboard");
    assert.equal(safeDashboardPath("//evil"), "/dashboard");
  });

  test("safeAuthNextPath allows recovery + system pages", () => {
    assert.equal(safeAuthNextPath("/redefinir-senha"), "/redefinir-senha");
    assert.equal(safeAuthNextPath("/offline"), "/offline");
    assert.equal(safeAuthNextPath("/sem-permissao"), "/sem-permissao");
    assert.equal(safeAuthNextPath("/evil"), "/dashboard");
  });

  test("password recovery redirect uses public site url", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = PRODUCTION_SITE_URL;
    try {
      const url = getPasswordRecoveryRedirectUrl({}, "/redefinir-senha");
      assert.ok(url.startsWith(PRODUCTION_SITE_URL));
      assert.ok(url.includes("/auth/callback"));
      assert.ok(url.includes(encodeURIComponent("/redefinir-senha")));
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  test("auth actions export recovery handlers", () => {
    const src = readFileSync(join(root, "app/actions/auth.ts"), "utf8");
    assert.ok(src.includes("requestPasswordReset"));
    assert.ok(src.includes("updatePassword"));
    assert.ok(src.includes("resetPasswordForEmail"));
    assert.ok(src.includes("signOut"));
  });
});

describe("RC4.2 Workspace & RLS mirrors", () => {
  test("personal rows isolated between users", () => {
    assert.equal(
      canAccessPersonalRow({ actorUserId: "a", rowUserId: "a" }),
      true
    );
    assert.equal(
      canAccessPersonalRow({ actorUserId: "a", rowUserId: "b" }),
      false
    );
  });

  test("workspace membership required for workspace rows", () => {
    assert.equal(
      canAccessWorkspaceRow({
        actorWorkspaceId: "ws1",
        rowWorkspaceId: "ws1",
        isMember: true,
      }),
      true
    );
    assert.equal(
      canAccessWorkspaceRow({
        actorWorkspaceId: "ws2",
        rowWorkspaceId: "ws1",
        isMember: true,
      }),
      false
    );
    assert.equal(
      canAccessWorkspaceRow({
        actorWorkspaceId: "ws1",
        rowWorkspaceId: "ws1",
        isMember: false,
      }),
      false
    );
  });

  test("visibility default is PRIVATE", () => {
    assert.equal(DEFAULT_VISIBILITY.memory, "PRIVATE");
    assert.equal(
      canViewerAccess({
        viewerUserId: "other",
        ownerUserId: "owner",
        visibilityScope: "PRIVATE",
        workspaceId: "ws",
        viewerWorkspaceId: "ws",
        isWorkspaceMember: true,
      }),
      false
    );
  });
});

describe("RC4.2 Brain modules (Decision / Scenario / Priorities)", () => {
  const sources = {
    memories: [{ id: "m1", title: "M", confidence: 60 }],
    worldEntities: [{ id: "e1", name: "E" }],
    cognitiveArtifacts: [
      {
        id: "c1",
        title: "C",
        summary: "s",
        confidence: 55,
        artifactType: "INSIGHT",
      },
    ],
    discoveries: [
      {
        id: "d1",
        title: "Opp",
        summary: "s",
        type: "OPPORTUNITY",
        confidence: 70,
        impact: "HIGH",
        urgency: "MEDIUM",
        status: "GENERATED",
      },
      {
        id: "d2",
        title: "Risk",
        summary: "s",
        type: "RISK",
        confidence: 66,
        impact: "HIGH",
        urgency: "HIGH",
        status: "GENERATED",
      },
    ],
    knowledgeDocuments: [{ id: "k1", title: "Doc", type: "note" }],
    projects: [{ id: "p1", name: "P", status: "active" }],
    businesses: [{ id: "b1", name: "B" }],
    identityHints: [{ id: "i1", title: "I" }],
  };

  test("Decision Support generates cards with executionInfluence none", () => {
    const { cards } = generateDecisionsPure(createEmptyDecisionState(), {
      userId: "u1",
      workspaceId: "ws1",
      sources,
    });
    assert.ok(cards.length > 0);
    assert.ok(cards.every((c) => c.executionInfluence === "none"));
    assert.equal(
      canViewDecision(cards[0], {
        userId: "u2",
        workspaceId: "ws1",
        isWorkspaceMember: true,
      }),
      false
    );
  });

  test("Scenario Engine simulates with executionInfluence none", () => {
    const { scenarios } = simulateScenariosPure(createEmptyScenarioState(), {
      userId: "u1",
      workspaceId: "ws1",
      sources: {
        ...sources,
        decisions: [],
      },
      whatIfPrompt: "E se lançarmos o MVP?",
    });
    assert.ok(scenarios.length > 0);
    assert.ok(scenarios.every((s) => s.executionInfluence === "none"));
    assert.equal(
      canViewScenario(scenarios[0], {
        userId: "u2",
        isWorkspaceMember: true,
        workspaceId: "ws1",
      }),
      false
    );
  });

  test("Prioritization Engine ranks with executionInfluence none", () => {
    const { items } = generatePrioritiesPure(createEmptyPriorityState(), {
      userId: "u1",
      workspaceId: "ws1",
      sources: {
        ...sources,
        decisions: [],
        scenarios: [],
      },
    });
    assert.ok(items.length > 0);
    assert.ok(items.every((i) => i.executionInfluence === "none"));
    assert.equal(
      canViewPriority(items[0], {
        userId: "u2",
        workspaceId: "ws1",
        isWorkspaceMember: true,
      }),
      false
    );
  });
});

describe("RC4.2 Knowledge / Discovery / Projects routes", () => {
  test("dashboard routes for RC4 modules exist", () => {
    for (const route of [
      "app/dashboard/discovery/page.tsx",
      "app/dashboard/knowledge/page.tsx",
      "app/dashboard/projects/page.tsx",
      "app/dashboard/decisions/page.tsx",
      "app/dashboard/scenarios/page.tsx",
      "app/dashboard/priorities/page.tsx",
    ]) {
      assert.ok(fileExists(route), route);
    }
  });

  test("smoke route list covers login + brain centers", () => {
    assert.ok(PRODUCTION_ROUTE_SMOKE.includes("/login"));
    assert.ok(PRODUCTION_ROUTE_SMOKE.includes("/dashboard/discovery"));
    assert.ok(PRODUCTION_ROUTE_SMOKE.includes("/dashboard/knowledge"));
    assert.ok(PRODUCTION_ROUTE_SMOKE.includes("/dashboard/projects"));
    assert.ok(PRODUCTION_ROUTE_SMOKE.includes("/dashboard/decisions"));
    assert.ok(PRODUCTION_ROUTE_SMOKE.includes("/dashboard/scenarios"));
    assert.ok(PRODUCTION_ROUTE_SMOKE.includes("/dashboard/priorities"));
  });
});

describe("RC4.2 Migrations checklist", () => {
  test("brain migrations listed and files exist", () => {
    assert.ok(BRAIN_MIGRATIONS_RC4_2.length >= 15);
    for (const name of BRAIN_MIGRATIONS_RC4_2) {
      assert.ok(
        fileExists(join("supabase/migrations", name)),
        `missing migration ${name}`
      );
    }
  });

  test("checklist doc references sprint 7.2 prioritization", () => {
    const doc = readFileSync(
      join(root, "docs/deployment/migrations-checklist.md"),
      "utf8"
    );
    assert.ok(doc.includes("sprint7_2_prioritization"));
    assert.ok(/nenhuma migration automática/i.test(doc));
  });
});

describe("RC4.2 Logger safety", () => {
  test("prodLog redacts sensitive meta keys", () => {
    const logs: unknown[] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => {
      logs.push(args[1]);
    };
    try {
      prodLog("info", "test", {
        scope: "rc4.2",
        userId: "1234567890abcdef",
        meta: {
          password: "secret",
          token: "abc",
          routeCount: 3,
        },
      });
    } finally {
      console.info = original;
    }
    const payload = logs[0] as {
      userId: string;
      meta: Record<string, unknown>;
    };
    assert.equal(payload.meta.password, "[redacted]");
    assert.equal(payload.meta.token, "[redacted]");
    assert.equal(payload.meta.routeCount, 3);
    assert.ok(payload.userId.includes("…"));
    assert.ok(!String(payload.userId).includes("1234567890abcdef"));
  });
});

describe("RC4.2 Proxy / vercel config", () => {
  test("proxy protects dashboard and allows recovery route", () => {
    const proxy = readFileSync(join(root, "lib/supabase/proxy.ts"), "utf8");
    assert.ok(proxy.includes("/dashboard"));
    assert.ok(proxy.includes("/recuperar-senha"));
    assert.ok(fileExists("proxy.ts"));
    assert.ok(fileExists("vercel.json"));
  });
});
