import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeHeuristicCreativeScore,
  computeOverallCreativeScore,
  hasCreativeDirectorPackage,
  mergeCreativeDirectorMetadata,
  readCreativeDirectorMetadata,
} from "./creative-director";
import type { CreativeAsset } from "@/types/database";

describe("creative-director", () => {
  it("computes overall creative score with rejection penalty", () => {
    const overall = computeOverallCreativeScore({
      clareza: 80,
      promessa: 80,
      curiosidade: 80,
      dor: 80,
      cta: 80,
      risco_reprovacao: 20,
    });
    assert.equal(overall, 75);
  });

  it("reads and merges creative director metadata", () => {
    const merged = mergeCreativeDirectorMetadata({}, {
      package_id: "pkg-1",
      asset_ids: ["a1", "a2"],
      ready: true,
      creative_score: {
        clareza: 70,
        promessa: 70,
        curiosidade: 70,
        dor: 70,
        cta: 70,
        risco_reprovacao: 10,
        overall: 68,
      },
    });

    const director = readCreativeDirectorMetadata(merged);
    assert.equal(director?.package_id, "pkg-1");
    assert.equal(director?.asset_ids?.length, 2);
    assert.equal(hasCreativeDirectorPackage(merged), true);
  });

  it("computes heuristic score from ready assets", () => {
    const assets = [
      {
        id: "1",
        asset_type: "image",
        status: "ready",
        copy: "Descubra como resolver seu problema com CTA clique agora",
        title: "Imagem",
      },
      {
        id: "2",
        asset_type: "cta_variations",
        status: "ready",
        copy: "Garanta seu acesso",
        title: "CTAs",
      },
    ] as CreativeAsset[];

    const score = computeHeuristicCreativeScore({
      assets,
      copyHeadline: "Transforme sua rotina hoje",
    });

    assert.ok(score.clareza > 0);
    assert.ok(score.overall > 0);
    assert.ok(score.risco_reprovacao >= 0);
  });
});
