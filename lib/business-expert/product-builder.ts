/**
 * Product Builder — guided intake for digital offers.
 */

import { draftCompleteBusinessPlan } from "@/lib/business-expert/complete-planner";
import type {
  BusinessContext,
  ProductBuilderIntake,
  ProductBuilderResult,
} from "@/lib/business-expert/types";

export function runProductBuilder(
  intake: ProductBuilderIntake,
  ctx?: BusinessContext | null
): ProductBuilderResult {
  const missing: string[] = [];
  if (!intake.problem?.trim()) missing.push("Qual problema o produto resolve?");
  if (!intake.audience?.trim()) missing.push("Qual o público?");
  if (!intake.format?.trim()) {
    missing.push("Qual formato? (curso, mentoria, template, SaaS, pack…)");
  }
  if (!intake.ticket?.trim()) missing.push("Qual a faixa de ticket/preço?");
  if (!intake.deadline?.trim()) missing.push("Qual o prazo para lançar o MVP?");

  if (missing.length) {
    return {
      missingQuestions: missing,
      complete: false,
      name: null,
      promise: null,
      offer: null,
      modules: [],
      bonuses: [],
      structure: [],
      projectOutline: null,
      plan: null,
      summary: "Responda as perguntas para montar oferta e plano.",
    };
  }

  const problem = intake.problem!.trim();
  const audience = intake.audience!.trim();
  const format = intake.format!.trim();
  const ticket = intake.ticket!.trim();
  const deadline = intake.deadline!.trim();

  const shortAudience = audience.split(/[,.]/)[0]?.trim() ?? audience;
  const name = `${format} ${shortAudience}`.slice(0, 60);
  const promise = `Ajudar ${audience} a resolver “${problem}” de forma prática.`;
  const offer = `${format} com resultado claro · ticket ${ticket} · prazo MVP ${deadline}`;
  const modules = [
    "Diagnóstico do problema",
    "Método / framework principal",
    "Implementação passo a passo",
    "Templates e exemplos",
    "Plano de execução 7/14/30 dias",
  ];
  const bonuses = [
    "Checklist de implementação",
    "Script de vendas/onboarding",
    "Sessão ou FAQ de objeções",
  ];
  const structure = [
    "Promessa na landing",
    "Para quem é / não é",
    "Módulos",
    "Prova/bônus",
    "Preço e CTA",
    "Garantia honesta (se couber)",
  ];

  const plan = draftCompleteBusinessPlan({
    intent: "create_product",
    title: `Construir produto: ${name}`,
    objective: promise,
    mode: "produtor",
    context: ctx ?? null,
    checklist: [
      "Validar promessa com 5 pessoas do público",
      "Escrever outline dos módulos",
      "Montar oferta e preço",
      "Escolher plataforma de checkout",
      "Publicar MVP ou pré-venda",
    ],
    milestones: [
      { title: "Promessa validada", criteria: "≥ 5 conversas com sinal de compra" },
      { title: "MVP conteúdo", criteria: "Módulo 1 entregável" },
      { title: "Primeira venda", criteria: "Pagamento ou pré-venda" },
    ],
    kpis: [
      { name: "Conversas de validação", target: "≥ 5" },
      { name: "Taxa de interesse", target: "registrada" },
      { name: "Vendas MVP", target: "≥ 1" },
    ],
  });

  return {
    missingQuestions: [],
    complete: true,
    name,
    promise,
    offer,
    modules,
    bonuses,
    structure,
    projectOutline: { name: `Produto: ${name}`, description: offer },
    plan,
    summary: `Produto esboçado para ${audience}. Plataformas comuns: Kiwify/Hotmart/Gumroad/Stripe conforme formato — compare taxas com pesquisa atual se necessário.`,
  };
}
