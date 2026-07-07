import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runBusinessReasoning } from "@/utils/business-reasoning";

type BenchmarkExpectation = {
  prompt: string;
  problem?: string;
  market?: string;
  technology?: string;
  businessModel?: string;
  minConfidence?: number;
};

const BASE_PROMPTS: BenchmarkExpectation[] = [
  {
    prompt: "Quero ganhar R$10.000 por mês usando IA para pequenos negócios",
    problem: "Falta de automação",
    market: "Pequenos negócios (PME)",
    technology: "Inteligência Artificial",
    businessModel: "Ferramenta IA",
    minConfidence: 50,
  },
  {
    prompt: "Automação com IA para pequenos negócios — meta R$15.000/mês",
    problem: "Falta de automação",
    technology: "Inteligência Artificial",
    businessModel: "Ferramenta IA",
    minConfidence: 45,
  },
  {
    prompt: "Quero faturar R$20.000 ajudando advogados com marketing fraco",
    problem: "Marketing fraco",
    technology: "Marketing Digital",
    minConfidence: 40,
  },
  {
    prompt: "Curso de Excel para contadores com fluxo de caixa ruim",
    problem: "Fluxo de caixa ruim",
    technology: "Excel",
    minConfidence: 35,
  },
  {
    prompt: "Mentoria para dentistas com poucas vendas",
    problem: "Poucas vendas",
    businessModel: "Mentoria",
    minConfidence: 35,
  },
  {
    prompt: "Agência de tráfego pago para e-commerce com baixa conversão",
    problem: "Baixa conversão",
    technology: "Marketing Digital",
    businessModel: "Agência",
    minConfidence: 40,
  },
  {
    prompt: "SaaS de automação para atendimento lento em PME",
    problem: "Atendimento lento",
    businessModel: "SaaS",
    minConfidence: 35,
  },
  {
    prompt: "Templates para freelancers com muito trabalho manual",
    problem: "Muito trabalho manual",
    businessModel: "Templates",
    minConfidence: 35,
  },
  {
    prompt: "Comunidade para empreendedores que perdem clientes",
    problem: "Perder clientes",
    businessModel: "Comunidade",
    minConfidence: 35,
  },
  {
    prompt: "Consultoria para leads ruins em marketing digital",
    problem: "Leads ruins",
    businessModel: "Consultoria",
    minConfidence: 35,
  },
];

const REVENUE_TARGETS = ["R$5.000", "R$10.000", "R$15.000", "R$20.000", "R$30.000"];
const TECH_PHRASES = [
  { phrase: "usando IA", technology: "Inteligência Artificial", problem: "Falta de automação" },
  { phrase: "com ChatGPT", technology: "Inteligência Artificial", problem: "Falta de automação" },
  { phrase: "com Excel", technology: "Excel", problem: "Muito trabalho manual" },
  { phrase: "com Instagram", technology: "Instagram", problem: "Marketing fraco" },
  { phrase: "com tráfego pago", technology: "Marketing Digital", problem: "Marketing fraco" },
];
const AVATAR_PHRASES = [
  { phrase: "para pequenos negócios", market: "Pequenos negócios (PME)" },
  { phrase: "para advogados", market: null },
  { phrase: "para dentistas", market: null },
  { phrase: "para empreendedores", market: null },
  { phrase: "para freelancers", market: null },
];
const PROBLEM_PHRASES = [
  { phrase: "com baixa conversão", problem: "Baixa conversão" },
  { phrase: "com poucas vendas", problem: "Poucas vendas" },
  { phrase: "com marketing fraco", problem: "Marketing fraco" },
  { phrase: "com atendimento lento", problem: "Atendimento lento" },
  { phrase: "com leads ruins", problem: "Leads ruins" },
  { phrase: "com falta de organização", problem: "Falta de organização" },
  { phrase: "com muito trabalho manual", problem: "Muito trabalho manual" },
  { phrase: "com fluxo de caixa ruim", problem: "Fluxo de caixa ruim" },
];
const MODEL_PHRASES = [
  { phrase: "via mentoria", businessModel: "Mentoria" },
  { phrase: "com curso online", businessModel: "Curso" },
  { phrase: "com SaaS", businessModel: "SaaS" },
  { phrase: "com agência", businessModel: "Agência" },
  { phrase: "com templates", businessModel: "Templates" },
];

function buildGeneratedPrompts(): BenchmarkExpectation[] {
  const generated: BenchmarkExpectation[] = [];

  for (const revenue of REVENUE_TARGETS) {
    for (const tech of TECH_PHRASES) {
      generated.push({
        prompt: `Quero ganhar ${revenue} por mês ${tech.phrase} para pequenos negócios`,
        technology: tech.technology,
        problem: tech.problem,
        market: "Pequenos negócios (PME)",
        minConfidence: 40,
      });
    }
  }

  for (const revenue of REVENUE_TARGETS) {
    for (const avatar of AVATAR_PHRASES) {
      for (const problem of PROBLEM_PHRASES.slice(0, 3)) {
        generated.push({
          prompt: `Quero faturar ${revenue}/mês ${avatar.phrase} ${problem.phrase}`,
          problem: problem.problem,
          market: avatar.market ?? undefined,
          minConfidence: 30,
        });
      }
    }
  }

  for (const model of MODEL_PHRASES) {
    for (const problem of PROBLEM_PHRASES) {
      generated.push({
        prompt: `Quero ganhar R$12.000 por mês ${model.phrase} ${problem.phrase}`,
        problem: problem.problem,
        businessModel: model.businessModel,
        minConfidence: 30,
      });
    }
  }

  return generated;
}

export const BENCHMARK_PROMPTS: BenchmarkExpectation[] = [
  ...BASE_PROMPTS,
  ...buildGeneratedPrompts(),
];

function matchesExpectation(actual: string | null, expected?: string): boolean {
  if (!expected) return true;
  if (!actual) return false;
  return actual.toLowerCase().includes(expected.toLowerCase());
}

describe("business reasoning benchmark", () => {
  it(`has at least 100 prompts (found ${BENCHMARK_PROMPTS.length})`, () => {
    assert.ok(BENCHMARK_PROMPTS.length >= 100);
  });

  for (const [index, entry] of BENCHMARK_PROMPTS.entries()) {
    it(`[${index + 1}] ${entry.prompt.slice(0, 60)}${entry.prompt.length > 60 ? "…" : ""}`, () => {
      const result = runBusinessReasoning(entry.prompt);

      assert.ok(result.primaryProblem, "deve identificar problema");
      assert.ok(result.recommendedBusinessModel, "deve recomendar modelo");
      assert.ok(result.businessModelJustification.length > 20, "deve justificar modelo");
      assert.ok(result.confidence >= (entry.minConfidence ?? 25), `confidence ${result.confidence}`);

      if (entry.problem) {
        const problemOk =
          matchesExpectation(result.primaryProblem, entry.problem) ||
          result.problems.some((p) => matchesExpectation(p, entry.problem));
        assert.ok(
          problemOk,
          `problema esperado "${entry.problem}", obteve "${result.primaryProblem}" [${result.problems.join(", ")}]`
        );
      }

      if (entry.market) {
        assert.ok(matchesExpectation(result.market, entry.market), `mercado: ${result.market}`);
      }

      if (entry.technology) {
        assert.ok(
          matchesExpectation(result.technology, entry.technology),
          `tecnologia: ${result.technology}`
        );
      }

      if (entry.businessModel) {
        assert.ok(
          matchesExpectation(result.recommendedBusinessModel, entry.businessModel) ||
            result.rankedModels.some((m) => matchesExpectation(m.model, entry.businessModel)),
          `modelo: ${result.recommendedBusinessModel}`
        );
      }
    });
  }
});
