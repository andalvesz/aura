import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runOpportunityEngine } from "@/lib/opportunity/opportunity-engine";
import {
  computeRealityScore,
  isOpportunityCompatible,
  parseRealityProfile,
} from "@/utils/reality-engine";

type BenchmarkCase = {
  prompt: string;
  maxRealityScore?: number;
  minRealityScore?: number;
  blockedModels?: string[];
  requiredModels?: string[];
  minCapital?: number;
  maxCapital?: number;
};

const CAPITAL_VARIANTS = [200, 500, 2000, 20000];
const TIME_VARIANTS = [
  { label: "2h por dia", suffix: "2h por dia" },
  { label: "fins de semana", suffix: "apenas fins de semana" },
  { label: "8h integral", suffix: "dedicação total 8h por dia" },
];
const TEAM_VARIANTS = [
  { label: "sozinho", suffix: "estou sozinho" },
  { label: "equipe", suffix: "tenho equipe" },
];
const EXPERIENCE_VARIANTS = [
  { label: "iniciante", suffix: "sou iniciante" },
  { label: "vendas", suffix: "tenho experiência em vendas" },
  { label: "avançado", suffix: "sou avançado com anos de experiência" },
];
const PROFESSION_VARIANTS = [
  { label: "médico", suffix: "sou médico" },
  { label: "advogado", suffix: "sou advogado" },
  { label: "tráfego", suffix: "sou gestor de tráfego" },
];
const VISIBILITY_VARIANTS = [
  { label: "não aparecer", suffix: "não quero aparecer" },
  { label: "audiência", suffix: "já tenho audiência" },
];

function buildBenchmarkCases(): BenchmarkCase[] {
  const cases: BenchmarkCase[] = [];

  for (const capital of CAPITAL_VARIANTS) {
    cases.push({
      prompt: `Tenho R$${capital}, quero ganhar R$5.000 por mês`,
      maxCapital: capital + 100,
      minCapital: capital - 100,
      blockedModels: capital <= 500 ? ["SaaS", "Marketplace"] : undefined,
    });
  }

  for (const time of TIME_VARIANTS) {
    cases.push({
      prompt: `Tenho R$2.000, ${time.suffix}, quero ganhar R$8.000`,
      blockedModels: time.label === "fins de semana" ? ["SaaS"] : undefined,
    });
  }

  for (const team of TEAM_VARIANTS) {
    cases.push({
      prompt: `Tenho R$1.000, ${team.suffix}, iniciante, quero R$6.000/mês`,
    });
  }

  for (const exp of EXPERIENCE_VARIANTS) {
    cases.push({
      prompt: `Tenho R$800, ${exp.suffix}, quero ganhar R$7.000`,
      blockedModels: exp.label === "iniciante" ? ["SaaS"] : undefined,
    });
  }

  for (const prof of PROFESSION_VARIANTS) {
    cases.push({
      prompt: `Tenho R$3.000, ${prof.suffix}, quero ganhar R$15.000 por mês`,
    });
  }

  for (const vis of VISIBILITY_VARIANTS) {
    cases.push({
      prompt: `Tenho R$1.500, ${vis.suffix}, quero ganhar R$10.000`,
    });
  }

  const combos = [
    "Tenho R$200, iniciante, sozinho, 2h por dia",
    "Tenho R$500, iniciante, sozinho, 2h por dia, não quero aparecer",
    "Tenho R$2.000, gestor de tráfego, quero ganhar R$12.000",
    "Tenho R$20.000, tenho equipe, avançado, quero R$50.000",
    "Tenho R$500, sou advogado, iniciante, quero R$8.000",
    "Tenho R$1.000, já tenho audiência, quero R$20.000",
    "Tenho R$5.000, sei programar, 6h por dia, quero SaaS R$30.000",
    "Tenho R$200, apenas fins de semana, iniciante",
    "Tenho R$10.000, médico, quero R$40.000",
    "Tenho R$500, experiência em vendas, quero R$6.000",
  ];

  for (const base of combos) {
    cases.push({ prompt: `${base} — meta mensal declarada` });
  }

  while (cases.length < 100) {
    const i = cases.length;
    const capital = [200, 500, 1000, 2000, 5000, 10000, 20000][i % 7]!;
    cases.push({
      prompt: `Cenário ${i + 1}: tenho R$${capital}, ${i % 2 === 0 ? "sozinho" : "com equipe"}, quero R$${(i + 1) * 1000}`,
      blockedModels: capital <= 500 ? ["SaaS"] : undefined,
    });
  }

  return cases.slice(0, 100);
}

const BENCHMARK_CASES = buildBenchmarkCases();

describe("reality engine benchmark — 100 cenários reais", () => {
  for (const [index, scenario] of BENCHMARK_CASES.entries()) {
    it(`cenário ${index + 1}: ${scenario.prompt.slice(0, 60)}...`, () => {
      const profile = parseRealityProfile(scenario.prompt);
      const score = computeRealityScore(profile);

      if (scenario.minCapital !== undefined) {
        assert.ok(profile.availableCapital >= scenario.minCapital);
      }
      if (scenario.maxCapital !== undefined) {
        assert.ok(profile.availableCapital <= scenario.maxCapital);
      }
      if (scenario.minRealityScore !== undefined) {
        assert.ok(score >= scenario.minRealityScore);
      }
      if (scenario.maxRealityScore !== undefined) {
        assert.ok(score <= scenario.maxRealityScore);
      }

      if (scenario.blockedModels) {
        for (const modelId of ["saas", "marketplace"] as const) {
          const label = modelId === "saas" ? "SaaS" : "Marketplace";
          if (scenario.blockedModels.includes(label)) {
            assert.equal(
              isOpportunityCompatible(modelId, profile, score),
              false,
              `${label} should be incompatible for: ${scenario.prompt}`
            );
          }
        }
      }

      const result = runOpportunityEngine(scenario.prompt);
      assert.equal(result.recommendations.length, 3);
      assert.ok(result.reality.realityScore >= 0 && result.reality.realityScore <= 100);

      if (scenario.blockedModels) {
        const topModels = result.recommendations.map((r) => r.businessModel);
        for (const blocked of scenario.blockedModels) {
          assert.ok(
            !topModels.includes(blocked),
            `TOP 3 should not include ${blocked} for: ${scenario.prompt} — got ${topModels.join(", ")}`
          );
        }
      }

      assert.ok(result.recommendations.every((r) => r.realityCompatible));
    });
  }
});
