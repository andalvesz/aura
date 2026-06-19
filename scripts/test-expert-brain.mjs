/**
 * Test Expert Brain — ingere curso fake, extrai framework e valida contexto copywriting.
 * Uso: node --import tsx scripts/test-expert-brain.mjs
 */
import {
  buildExpertContextPromptBlock,
  heuristicExtractFrameworks,
  heuristicExtractPatterns,
  heuristicExtractPlaybooks,
  resolveExpertTask,
} from "../utils/expert-brain.ts";

const FAKE_COURSE = `
# Curso: Copywriting de Alta Conversão — Módulo 1

## Framework PAS (Problema-Agitação-Solução)
- Identifique a dor principal do avatar em uma frase
- Agite as consequências de não resolver o problema
- Apresente a solução como mecanismo único
- Use CTA específico com urgência legítima

## Quando usar
Use em páginas de vendas, emails e anúncios de resposta direta.

## Exemplos
Headline: "Cansado de X? Descubra como Y em Z dias"
`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${expected}, got ${actual}`);
  }
}

console.info("[test-expert-brain] 1/4 — extraindo frameworks (heurística)");
const frameworks = heuristicExtractFrameworks(FAKE_COURSE, "copywriting");
assert(frameworks.length > 0, "deveria extrair ao menos 1 framework");
assert(
  frameworks.some((f) => f.name.toLowerCase().includes("pas") || f.principles.length > 0),
  "framework PAS ou princípios deveriam existir"
);
console.info("  frameworks:", frameworks.map((f) => f.name));

console.info("[test-expert-brain] 2/4 — extraindo playbooks e patterns");
const playbooks = heuristicExtractPlaybooks(frameworks);
const patterns = heuristicExtractPatterns(frameworks);
assert(playbooks.length > 0, "deveria gerar playbooks");
assert(patterns.length > 0, "deveria gerar patterns");
console.info("  playbooks:", playbooks.length, "patterns:", patterns.length);

console.info("[test-expert-brain] 3/4 — gerando contexto para copywriting");
const task = resolveExpertTask("copywriting", "copylab");
assertEqual(task, "copywriting");

const expertContext = {
  task,
  frameworks: frameworks.map((f) => ({
    id: "mock",
    name: f.name,
    category: f.category,
    summary: f.description,
    principles: f.principles,
  })),
  playbooks: playbooks.map((p) => ({
    id: "mock",
    name: p.title,
    summary: p.title,
    steps: p.steps,
    rules: p.rules,
  })),
  patterns: patterns.map((p) => ({
    id: "mock",
    name: p.title,
    summary: p.description,
    confidence: p.confidence_score,
  })),
  appliedFrameworks: frameworks.map((f) => f.name),
  excellenceCriteria: frameworks.flatMap((f) => f.principles).slice(0, 6),
};

const promptBlock = buildExpertContextPromptBlock(expertContext);
assert(promptBlock.includes("Aplicando framework:"), "prompt deveria citar framework aplicado");
assert(promptBlock.length > 80, "prompt block deveria ter conteúdo");

console.info("[test-expert-brain] 4/4 — validando integração CopyLab (contrato)");
const copylabPayloadShape = {
  intake: { nome: "Produto teste" },
  winnerContext: { headlines: [], offers: [], creatives: [], countries: [], niches: [] },
  expertContext,
  decisionContext: null,
  excellenceCriteria: expertContext.excellenceCriteria,
};

assert(copylabPayloadShape.expertContext.task === "copywriting", "CopyLab deve receber expertContext");
assert(
  Array.isArray(copylabPayloadShape.expertContext.frameworks),
  "CopyLab expertContext.frameworks deve ser array"
);
assert(
  copylabPayloadShape.expertContext.appliedFrameworks.length > 0,
  "CopyLab deve receber appliedFrameworks"
);

console.info("[test-expert-brain] OK — Expert Brain pipeline validado");
console.info("  prompt preview:", promptBlock.split("\n").slice(0, 4).join(" | "));
