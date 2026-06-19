import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExpertContextPromptBlock,
  heuristicExtractFrameworks,
  heuristicExtractPatterns,
  rankFrameworksForTask,
  resolveExpertTask,
} from "./expert-brain";
import type { ExpertFramework } from "../types/database";

test("resolveExpertTask maps module to category", () => {
  assert.equal(resolveExpertTask(null, "copylab"), "copywriting");
  assert.equal(resolveExpertTask("landing_page"), "landing_page");
});

test("heuristicExtractFrameworks extracts principles from bullets", () => {
  const raw = `# Framework AIDA para Copy
- Atenção com headline magnética
- Interesse com história do avatar
- Desejo com prova social
- Ação com CTA claro`;

  const frameworks = heuristicExtractFrameworks(raw, "copywriting");
  assert.ok(frameworks.length >= 1);
  assert.equal(frameworks[0].category, "copywriting");
  assert.ok(frameworks[0].principles.length >= 3);
});

test("buildExpertContextPromptBlock cites applied frameworks", () => {
  const block = buildExpertContextPromptBlock({
    task: "copywriting",
    frameworks: [
      {
        id: "1",
        name: "AIDA Pro",
        category: "copywriting",
        summary: "Estrutura clássica de persuasão",
        principles: ["Headline magnética"],
      },
    ],
    playbooks: [],
    patterns: [],
    decisionRules: [],
    checklists: [],
    failurePatterns: [],
    successPatterns: [],
    appliedFrameworks: ["AIDA Pro"],
    excellenceCriteria: ["Headline magnética"],
  });

  assert.match(block, /Aplicando framework: AIDA Pro/);
  assert.match(block, /Headline magnética/);
});

test("rankFrameworksForTask prioritizes matching category", () => {
  const frameworks: ExpertFramework[] = [
    {
      id: "a",
      user_id: "u",
      source_id: null,
      name: "Funil Perpétuo",
      category: "funnel_strategy",
      description: "Funil",
      principles: [],
      when_to_use: null,
      examples: [],
      metadata: {},
      created_at: new Date().toISOString(),
    },
    {
      id: "b",
      user_id: "u",
      source_id: null,
      name: "Copy PAS",
      category: "copywriting",
      description: "Problema agitação solução",
      principles: ["Problema claro"],
      when_to_use: null,
      examples: [],
      metadata: {},
      created_at: new Date().toISOString(),
    },
  ];

  const ranked = rankFrameworksForTask(frameworks, "copywriting");
  assert.equal(ranked[0].name, "Copy PAS");
});

test("heuristicExtractPatterns creates decision and quality patterns", () => {
  const frameworks = heuristicExtractFrameworks(
    "# Oferta Irresistível\n- Stack de valor\n- Garantia forte",
    "offer"
  );
  const patterns = heuristicExtractPatterns(frameworks);
  assert.ok(patterns.some((p) => p.pattern_type === "decision_rule"));
  assert.ok(patterns.some((p) => p.pattern_type === "quality_criterion"));
});
