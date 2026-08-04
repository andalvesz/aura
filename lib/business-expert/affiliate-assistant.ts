/**
 * Affiliate Assistant — guided intake + platforms + plan outline.
 */

import {
  marketplacesWithAffiliates,
  getMarketplace,
} from "@/lib/business-expert/marketplaces";
import { draftCompleteBusinessPlan } from "@/lib/business-expert/complete-planner";
import type {
  AffiliateAssistantResult,
  AffiliateIntake,
  BusinessContext,
} from "@/lib/business-expert/types";

export function runAffiliateAssistant(
  intake: AffiliateIntake,
  ctx?: BusinessContext | null
): AffiliateAssistantResult {
  const missing: string[] = [];
  if (!intake.timeAvailable || intake.timeAvailable === "unknown") {
    missing.push("Quanto tempo por semana você tem? (side / part-time / full-time)");
  }
  if (!intake.capital || intake.capital === "unknown") {
    missing.push("Qual faixa de capital? (bootstrap / low / medium / high)");
  }
  if (intake.paidTraffic === undefined) {
    missing.push("Vai usar tráfego pago? (sim/não)");
  }
  if (intake.organic === undefined) {
    missing.push("Vai usar orgânico (conteúdo)? (sim/não)");
  }
  if (!intake.experience || intake.experience === "none") {
    missing.push("Qual sua experiência com vendas/conteúdo?");
  }
  if (!intake.financialGoal?.trim()) {
    missing.push("Qual o objetivo financeiro nos próximos 90 dias?");
  }

  if (missing.length) {
    return {
      missingQuestions: missing,
      complete: false,
      recommendedPlatforms: [],
      platformDiffs: [],
      plan: null,
      projectOutline: null,
      summary:
        "Para recomendar afiliação com qualidade, responda as perguntas em aberto.",
    };
  }

  let platforms = marketplacesWithAffiliates();
  if (intake.paidTraffic && !intake.organic) {
    platforms = platforms.filter((p) =>
      ["hotmart", "monetizze", "braip", "kiwify"].includes(p.id)
    );
  }
  if (intake.organic && !intake.paidTraffic) {
    platforms = platforms.filter((p) =>
      ["hotmart", "kiwify", "eduzz", "monetizze"].includes(p.id)
    );
  }
  platforms = platforms.slice(0, 5);

  const platformDiffs = [
    "Hotmart: forte em marketplace e rede de afiliados — validar taxas atuais via pesquisa.",
    "Kiwify: setup BR ágil para produtores/afiliados com checkout local.",
    "Monetizze/Braip: redes clássicas BR — comparar cookie e comissão oficial.",
    "Eduzz: bom quando stack de lançamento importa.",
    "Nunca inventamos comissões/ranking — use provider de web research quando precisar de dado vivo.",
  ];

  const plan = draftCompleteBusinessPlan({
    intent: "affiliate",
    title: "Plano de vendas como afiliado",
    objective:
      intake.financialGoal ||
      "Gerar primeira comissão qualificada como afiliado",
    mode: "afiliado",
    context: ctx ?? null,
    checklist: [
      "Escolher 1 nicho",
      "Escolher 1 plataforma principal",
      "Selecionar 1–3 produtos alinhados",
      "Publicar 10 peças úteis",
      "Medir CTR e conversão",
    ],
    milestones: [
      { title: "Setup", criteria: "Conta + pixel/tracking básico" },
      { title: "Primeiras 10 publicações", criteria: "Conteúdo publicado" },
      { title: "Primeira comissão", criteria: "Venda rastreada" },
    ],
    kpis: [
      { name: "Peças publicadas / semana", target: "≥ 5" },
      { name: "CTR médio", target: "baseline em 14 dias" },
      { name: "Comissões", target: "≥ 1 em 30–60 dias" },
    ],
  });

  const projectOutline = {
    name: "Operação Afiliado",
    description: `Modo afiliado · capital ${intake.capital} · tempo ${intake.timeAvailable}`,
  };

  const names = platforms.map((p) => p.name).join(", ");
  return {
    missingQuestions: [],
    complete: true,
    recommendedPlatforms: platforms,
    platformDiffs,
    plan,
    projectOutline,
    summary: `Com base no seu perfil, priorize: ${names}. Comece com 1 plataforma e 1 nicho. ${getMarketplace("kiwify")?.guidanceNote ?? ""}`,
  };
}
