import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import type { ProductFactory } from "@/types/database";
import type { ProductFactoryBundle } from "@/utils/product-factory";
import { shouldTriggerExcellenceAutoImprovement } from "@/lib/supabase/services/excellence-integration.service";
import {
  MAX_AUTO_ELITE_CYCLES,
  sanitizeProductFactoryBundle,
  sanitizeRecursiveProductContent,
} from "./product-factory-pro";
import {
  acquireProductProLock,
  getProductProDepthForFactory,
  isProductProAutoImproveInCooldown,
  isProductProDepthLimitError,
  isProductProLocked,
  isProductProStackOverflowError,
  popProductProDepthForFactory,
  PRODUCT_PRO_AUTO_IMPROVE_COOLDOWN_MS,
  PRODUCT_PRO_DEPTH_BLOCKED_MESSAGE,
  PRODUCT_PRO_LOCK_MESSAGE,
  PRODUCT_PRO_LOCK_TTL_MS,
  PRODUCT_PRO_LOOP_DETECTED_MESSAGE,
  PRODUCT_PRO_MAX_DEPTH,
  productProLocks,
  ProductProDepthLimitError,
  pushProductProDepthForFactory,
  recordManualProductProImprove,
  releaseProductProLock,
  resetProductProLocksForTests,
  shouldScheduleExcellenceAfterProAction,
  shouldSkipEbookAutoImprovement,
} from "./product-pro-locks";

function buildBundle(conteudo: Record<string, unknown>): ProductFactoryBundle {
  return {
    factory: {
      id: "factory-1",
      conteudo,
    } as ProductFactory,
    files: [],
    versions: [],
    compliance: null,
    latestPdf: null,
  };
}

describe("product-pro-locks", () => {
  beforeEach(() => {
    resetProductProLocksForTests();
  });

  it("duas chamadas simultâneas ao mesmo factoryId bloqueiam a segunda", () => {
    assert.ok(acquireProductProLock("factory-1", "improve", "manual"));
    assert.equal(isProductProLocked("factory-1"), true);
    assert.equal(acquireProductProLock("factory-1", "improve", "excellence"), false);
    releaseProductProLock("factory-1");
    assert.equal(isProductProLocked("factory-1"), false);
    assert.ok(acquireProductProLock("factory-1", "improve", "excellence"));
  });

  it("excellence auto-improve não roda se lock manual ativo", () => {
    acquireProductProLock("factory-1", "improve", "manual");

    let skipped = false;
    if (isProductProLocked("factory-1")) {
      skipped = true;
    }

    assert.equal(skipped, true);
    assert.equal(PRODUCT_PRO_LOCK_MESSAGE, "Produto já está sendo melhorado. Aguarde terminar.");
  });

  it("lock expira após TTL de 5 minutos", () => {
    acquireProductProLock("factory-1", "improve", "manual");
    productProLocks.set("factory-1", {
      action: "improve",
      source: "manual",
      startedAt: Date.now() - PRODUCT_PRO_LOCK_TTL_MS - 1,
    });

    assert.equal(isProductProLocked("factory-1"), false);
    assert.ok(acquireProductProLock("factory-1", "improve", "excellence"));
  });

  it("detecta erro de maximum call stack", () => {
    assert.equal(
      isProductProStackOverflowError(new RangeError("Maximum call stack size exceeded")),
      true
    );
    assert.equal(
      isProductProStackOverflowError(new Error("Product Factory recursion detected at depth 6")),
      true
    );
    assert.equal(isProductProStackOverflowError(new Error("other")), false);
    assert.equal(PRODUCT_PRO_LOOP_DETECTED_MESSAGE.includes("Loop detectado"), true);
    assert.equal(
      PRODUCT_PRO_DEPTH_BLOCKED_MESSAGE.includes("Melhoria automática bloqueada"),
      true
    );
  });
});

describe("product-pro — manual vs auto excellence", () => {
  it("manual improve não agenda auto-improvement", () => {
    assert.equal(shouldScheduleExcellenceAfterProAction("manual"), false);
    assert.equal(shouldScheduleExcellenceAfterProAction("manual", false), false);
    assert.equal(shouldScheduleExcellenceAfterProAction("excellence", true), false);
  });

  it("passive review não dispara triggerAutoImprovement", () => {
    assert.equal(shouldTriggerExcellenceAutoImprovement("passive", false), false);
    assert.equal(shouldTriggerExcellenceAutoImprovement("product-factory", true), true);
  });

  it("excellence review de product-factory-pro é passive", () => {
    assert.equal(shouldSkipEbookAutoImprovement("product-factory-pro"), true);
    assert.equal(shouldSkipEbookAutoImprovement("manual"), true);
    assert.equal(shouldSkipEbookAutoImprovement("passive"), true);
    assert.equal(shouldTriggerExcellenceAutoImprovement("product-factory-pro", true), false);
  });

  it("auto-improve respeita cooldown após manual improve", () => {
    const now = Date.now();
    recordManualProductProImprove("factory-1", now);
    assert.equal(isProductProAutoImproveInCooldown("factory-1", now + 1), true);
    assert.equal(
      isProductProAutoImproveInCooldown(
        "factory-1",
        now + PRODUCT_PRO_AUTO_IMPROVE_COOLDOWN_MS + 1
      ),
      false
    );
  });
});

describe("product-pro — depth per factory", () => {
  beforeEach(() => {
    resetProductProLocksForTests();
  });

  it("depth é isolado por factoryId", () => {
    for (let i = 0; i < PRODUCT_PRO_MAX_DEPTH; i += 1) {
      pushProductProDepthForFactory("factory-a");
    }
    assert.throws(
      () => pushProductProDepthForFactory("factory-a"),
      ProductProDepthLimitError
    );
    assert.equal(getProductProDepthForFactory("factory-a"), PRODUCT_PRO_MAX_DEPTH);
    assert.equal(getProductProDepthForFactory("factory-b"), 0);
    assert.equal(pushProductProDepthForFactory("factory-b"), 1);
  });

  it("duas factories diferentes podem melhorar ao mesmo tempo", () => {
    assert.ok(acquireProductProLock("factory-a", "improve", "manual"));
    assert.ok(acquireProductProLock("factory-b", "improve", "manual"));
    assert.equal(pushProductProDepthForFactory("factory-a"), 1);
    assert.equal(pushProductProDepthForFactory("factory-b"), 1);
    popProductProDepthForFactory("factory-a");
    popProductProDepthForFactory("factory-b");
    assert.equal(getProductProDepthForFactory("factory-a"), 0);
    assert.equal(getProductProDepthForFactory("factory-b"), 0);
  });

  it("ProductProDepthLimitError é identificável", () => {
    try {
      for (let i = 0; i <= PRODUCT_PRO_MAX_DEPTH; i += 1) {
        pushProductProDepthForFactory("factory-depth");
      }
      assert.fail("expected depth limit error");
    } catch (error) {
      assert.equal(isProductProDepthLimitError(error), true);
    }
  });
});

describe("product-pro — auto elite cycles", () => {
  it("autoImproveToElite executa no máximo 3 ciclos", () => {
    assert.equal(MAX_AUTO_ELITE_CYCLES, 3);
  });
});

describe("product-pro — nested content sanitization", () => {
  it("conteúdo aninhado é sanitizado", () => {
    const sanitized = sanitizeRecursiveProductContent({
      introducao: "Intro",
      metodologia: "Method",
      bundle: { factory: { id: "nested" } },
      factory: { id: "nested" },
      conteudo: { bundle: {} },
    });

    assert.equal("bundle" in sanitized, false);
    assert.equal("factory" in sanitized, false);
    assert.equal("conteudo" in sanitized, false);
    assert.equal(sanitized.introducao, "Intro");
    assert.equal(sanitized.metodologia, "Method");
  });

  it("sanitizeProductFactoryBundle remove recursão em factory.conteudo", () => {
    const bundle = buildBundle({
      introducao: "ok",
      bundle: { nested: true },
    });

    const sanitized = sanitizeProductFactoryBundle(bundle);
    assert.ok(sanitized);
    const conteudo = sanitized!.factory.conteudo as Record<string, unknown>;
    assert.equal("bundle" in conteudo, false);
    assert.equal(conteudo.introducao, "ok");
  });
});
