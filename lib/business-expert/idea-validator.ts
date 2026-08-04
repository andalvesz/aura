/**
 * Idea Validator — structured evaluation without external data invention.
 */

import type {
  BusinessModeId,
  IdeaValidationInput,
  IdeaValidationResult,
  SupportedBusinessType,
} from "@/lib/business-expert/types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function validateBusinessIdea(
  input: IdeaValidationInput
): IdeaValidationResult {
  const idea = (input.idea ?? "").trim();
  const audience = (input.audience ?? "").trim();
  const market = (input.market ?? "").trim();
  const capital = input.capital ?? "unknown";
  const time = input.time ?? "unknown";
  const experience = input.experience ?? "none";

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];
  const competitionNotes: string[] = [];
  let score = 40;

  if (idea.length >= 12) {
    strengths.push("Ideia descrita com clareza mínima");
    score += 8;
  } else {
    weaknesses.push("Ideia vaga — precisa de problema e público em 1 frase");
    score -= 10;
  }

  if (audience) {
    strengths.push(`Público informado: ${audience}`);
    score += 10;
  } else {
    weaknesses.push("Público não definido");
    score -= 8;
  }

  if (market) {
    strengths.push(`Contexto de mercado: ${market}`);
    score += 6;
  } else {
    opportunities.push("Pesquisar mercado (sem inventar dados recentes — use web research)");
  }

  if (capital === "bootstrap" || capital === "low") {
    risks.push("Capital limitado exige validação barata e ciclo curto de receita");
    opportunities.push("Priorizar serviço, afiliado ou MVP minimal");
    score += 4;
  } else if (capital === "high" || capital === "funded") {
    strengths.push("Capital permite testes mais amplos");
    risks.push("Risco de overbuild antes de prova");
    score += 6;
  } else {
    weaknesses.push("Capital desconhecido");
  }

  if (time === "side") {
    risks.push("Tempo parcial — escopo precisa caber em poucas horas/semana");
    score += 2;
  } else if (time === "full-time") {
    strengths.push("Disponibilidade full-time acelera aprendizado");
    score += 8;
  }

  if (experience === "none" || experience === "beginner") {
    risks.push("Pouca experiência — preferir modelos com feedback rápido de mercado");
    score -= 4;
  } else if (experience === "advanced" || experience === "expert") {
    strengths.push("Experiência favorece execução e networking");
    score += 10;
  }

  const lower = idea.toLowerCase();
  let relatedTypes: SupportedBusinessType[] = ["produto-digital"];
  let relatedModes: BusinessModeId[] = ["produtor"];
  let difficulty: IdeaValidationResult["difficulty"] = "medium";

  if (/afiliad/.test(lower)) {
    relatedTypes = ["afiliado", "creator"];
    relatedModes = ["afiliado", "creator"];
    difficulty = "low";
    score += 6;
    opportunities.push("Começar com 1 plataforma e 1 nicho");
  } else if (/saas|software|app|ia\b|ai\b/.test(lower)) {
    relatedTypes = ["saas", "app", "ferramenta-ia"];
    relatedModes = ["startup"];
    difficulty = "high";
    risks.push("SaaS exige retenção e suporte contínuo");
    score -= 4;
  } else if (/restaurante|hamburguer|academia|sal[aã]o|loja|bar|cl[ií]nica/.test(lower)) {
    relatedTypes = ["negocios-locais", "loja-fisica"];
    relatedModes = ["empresa-local"];
    difficulty = capital === "high" || capital === "funded" ? "high" : "very-high";
    risks.push("CAPEX e operação local elevam ponto de equilíbrio");
    competitionNotes.push("Mapear 5 concorrentes no raio de deslocamento do cliente");
  } else if (/curso|infoproduto|mentoria|comunidade/.test(lower)) {
    relatedTypes = ["curso", "infoproduto", "mentoria", "comunidade"];
    relatedModes = ["produtor", "creator"];
    difficulty = "medium";
  } else if (/ag[eê]ncia/.test(lower)) {
    relatedTypes = ["agencia"];
    relatedModes = ["agencia"];
    difficulty = "medium";
  }

  competitionNotes.push(
    "Não inventamos ranking competitivo atual — use Research ou conhecimento do usuário"
  );
  opportunities.push("Definir critério de validação em 7–14 dias");
  opportunities.push("Pedir compromisso real (pagamento, agenda ou pré-venda)");

  score = clamp(score);
  if (score >= 75) difficulty = difficulty === "very-high" ? "high" : difficulty;

  const recommendation =
    score >= 70
      ? "Vale avançar com um teste de validação controlado."
      : score >= 50
        ? "Potencial moderado — preencha gaps de público, capital e prova antes de investir pesado."
        : "Ainda frágil — reescreva o problema e rode entrevistas antes de construir.";

  const nextSteps = [
    "Reescrever hipótese: Para [público], que sofre [dor], oferecemos [solução] mensurada por [métrica].",
    "Falar com 5 pessoas do público (script de 6 perguntas).",
    "Definir oferta mínima e preço de teste.",
    "Escolher métrica de go/no-go a priori.",
    "Registrar resultado no Business Expert e no Learning (sem auto-apply).",
  ];

  return {
    idea: idea || "(sem descrição)",
    strengths,
    weaknesses,
    risks,
    opportunities,
    competitionNotes,
    difficulty,
    recommendation,
    nextSteps,
    score,
    relatedModes,
    relatedTypes,
  };
}
