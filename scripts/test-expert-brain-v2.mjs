/**
 * Test Expert Brain V2 — valida pipeline completo com heurísticas offline.
 * Uso: node --import tsx scripts/test-expert-brain-v2.mjs
 */
import {
  buildExpertContextPromptBlock,
  buildExpertMentorPromptBlock,
  buildExpertRiskAssessmentFromPatterns,
  heuristicExtractChecklists,
  heuristicExtractDecisionRules,
  heuristicExtractFailurePatterns,
  heuristicExtractFrameworks,
  heuristicExtractPatterns,
  heuristicExtractPlaybooks,
  heuristicExtractSuccessPatterns,
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

console.info("[test-expert-brain-v2] 1/8 — frameworks");
const frameworks = heuristicExtractFrameworks(FAKE_COURSE, "copywriting");
assert(frameworks.length > 0, "deveria extrair frameworks");

console.info("[test-expert-brain-v2] 2/8 — playbooks");
const playbooks = heuristicExtractPlaybooks(frameworks);
assert(playbooks.length > 0, "deveria gerar playbooks");

console.info("[test-expert-brain-v2] 3/8 — patterns");
const patterns = heuristicExtractPatterns(frameworks);
assert(patterns.length > 0, "deveria gerar patterns");

console.info("[test-expert-brain-v2] 4/8 — decision rules");
const decisionRules = heuristicExtractDecisionRules(frameworks);
assert(decisionRules.length > 0, "deveria gerar decision rules");
assert(decisionRules.every((r) => r.rule?.trim()), "cada regra deve ter rule");

console.info("[test-expert-brain-v2] 5/8 — checklists");
const checklists = heuristicExtractChecklists(frameworks);
assert(checklists.length > 0, "deveria gerar checklists");
assert(checklists[0].items.length > 0, "checklist deve ter items");

console.info("[test-expert-brain-v2] 6/8 — failure patterns");
const failurePatterns = heuristicExtractFailurePatterns(frameworks);
assert(failurePatterns.length > 0, "deveria gerar failure patterns");

console.info("[test-expert-brain-v2] 7/8 — success patterns");
const successPatterns = heuristicExtractSuccessPatterns(frameworks);
assert(successPatterns.length > 0, "deveria gerar success patterns");

console.info("[test-expert-brain-v2] 8/8 — contexto transversal e risco");
const task = resolveExpertTask("copywriting", "copylab");
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
  decisionRules: decisionRules.map((r) => ({
    id: "mock",
    name: r.title,
    summary: r.rule,
    confidence: r.confidence_score,
  })),
  checklists: checklists.map((c) => ({
    id: "mock",
    name: c.title,
    summary: c.pass_criteria,
    steps: c.items,
  })),
  failurePatterns: failurePatterns.map((f) => ({
    id: "mock",
    name: f.title,
    summary: f.description,
  })),
  successPatterns: successPatterns.map((s) => ({
    id: "mock",
    name: s.title,
    summary: s.description,
  })),
  appliedFrameworks: frameworks.map((f) => f.name),
  excellenceCriteria: frameworks.flatMap((f) => f.principles).slice(0, 6),
};

const promptBlock = buildExpertContextPromptBlock(expertContext);
assert(promptBlock.includes("Regras de decisão expert:"), "prompt deve incluir decision rules");
assert(promptBlock.includes("Checklists expert:"), "prompt deve incluir checklists");
assert(promptBlock.includes("Padrões de sucesso expert:"), "prompt deve incluir success patterns");
assert(promptBlock.includes("Padrões de falha expert:"), "prompt deve incluir failure patterns");

const mentorBlock = buildExpertMentorPromptBlock({
  frameworks: expertContext.frameworks.slice(0, 2),
  decisionRules: expertContext.decisionRules.slice(0, 2),
  checklists: expertContext.checklists.slice(0, 1),
  promptBlock: "",
});
assert(mentorBlock.includes("framework utilizado"), "mentor deve pedir citação de framework");

const risk = buildExpertRiskAssessmentFromPatterns(
  {
    produto: "Ebook copywriting",
    oferta: "Stack de valor",
    funil: "VSL + checkout",
    campanha: "Meta ads cold traffic",
  },
  failurePatterns.map((pattern, index) => ({
    id: String(index),
    user_id: "mock",
    source_id: null,
    title: pattern.title,
    description: pattern.description,
    warning_signs: pattern.warning_signs,
    consequences: pattern.consequences,
    prevention_actions: pattern.prevention_actions,
    metadata: {},
    created_at: new Date().toISOString(),
  }))
);
assert(risk.risks.length > 0, "risk assessment deve detectar riscos");
assert(risk.preventionActions.length > 0, "risk assessment deve sugerir ações preventivas");

console.info("[test-expert-brain-v2] OK — Expert Brain V2 pipeline validado");
console.info("  counts:", {
  frameworks: frameworks.length,
  playbooks: playbooks.length,
  patterns: patterns.length,
  decisionRules: decisionRules.length,
  checklists: checklists.length,
  failurePatterns: failurePatterns.length,
  successPatterns: successPatterns.length,
});
