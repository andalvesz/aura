/**
 * Command Center — natural business language (B1.X).
 */

import { formatAdvisorMessage } from "@/lib/business-expert/advisor";
import { runBusinessExpert } from "@/lib/business-expert/business-engine";
import { formatComparisonMessage } from "@/lib/business-expert/kernel-bridge";
import {
  isBusinessExpertIntentMessage,
  parseBusinessIntent,
} from "@/lib/business-expert/validators";
import type { BusinessIntentKind } from "@/lib/business-expert/types";

export const BUSINESS_EXPERT_COMMAND_PATTERNS = {
  openBusiness: /quero\s+abrir\s+(um\s+)?neg[oó]cio/i,
  entrepreneurship: /quero\s+empreender/i,
  makeMoney: /quero\s+ganhar\s+dinheiro/i,
  validateIdea: /quero\s+validar\s+(uma\s+)?ideia/i,
  createCompany: /quero\s+criar\s+(uma\s+)?empresa/i,
  createCourse: /quero\s+criar\s+(um\s+)?curso/i,
  sellOnline: /quero\s+vender\s+online/i,
  liveInternet: /quero\s+viver\s+de\s+internet/i,
  bestPlatform: /qual\s+melhor\s+plataforma/i,
  createProduct: /como\s+criar\s+(um\s+)?produto|quero\s+criar\s+(um\s+)?produto/i,
  affiliate: /vender\s+como\s+afiliad|quero\s+vender\s+como\s+afiliad/i,
};

export type BusinessExpertCommandResult = {
  matched: boolean;
  intent: BusinessIntentKind;
  message: string;
  href: string;
  requiresConfirmation: boolean;
  planTitle: string | null;
};

export function handleBusinessExpertCommand(
  message: string,
  userId = "anonymous"
): BusinessExpertCommandResult {
  const text = message.trim();
  const intent = parseBusinessIntent(text);
  if (!isBusinessExpertIntentMessage(text) && intent === "unknown") {
    return {
      matched: false,
      intent: "unknown",
      message: "",
      href: "/dashboard/business-expert",
      requiresConfirmation: false,
      planTitle: null,
    };
  }

  const run = runBusinessExpert({ userId, message: text, intent });
  const parts = [formatAdvisorMessage(run.advisor)];

  if (run.comparison) {
    parts.push("", formatComparisonMessage(run.comparison));
  }
  if (run.affiliate) {
    parts.push(
      "",
      run.affiliate.complete
        ? run.affiliate.summary
        : `Affiliate Assistant — ainda preciso: ${run.affiliate.missingQuestions.join(" · ")}`
    );
  }
  if (run.product) {
    parts.push(
      "",
      run.product.complete
        ? `${run.product.summary}\nNome: ${run.product.name}\nPromessa: ${run.product.promise}`
        : `Product Builder — ${run.product.missingQuestions.join(" · ")}`
    );
  }
  if (run.local?.complete) {
    parts.push("", run.local.summary);
  }
  if (run.ideaValidation) {
    parts.push(
      "",
      `Validador: score ${run.ideaValidation.score}/100 · ${run.ideaValidation.recommendation}`
    );
  }
  if (run.scenario) {
    parts.push(
      "",
      "Cenário (para core Scenario Engine):",
      ...run.scenario.branches.map(
        (b) => `• ${b.label}: ${b.upside} / risco: ${b.downside}`
      )
    );
  }
  if (run.planDraft) {
    parts.push(
      "",
      `Rascunho de plano (core Planner): “${run.planDraft.title}” · checklist ${run.planDraft.checklist.length} itens · KPIs ${run.planDraft.kpis.length}.`
    );
  }
  if (run.webResearch) {
    parts.push(
      "",
      `Web research: ${run.webResearch.status} — ${run.webResearch.disclaimer}`
    );
  }
  parts.push(
    "",
    "Learning: sinais empresariais geram propostas revisáveis (sem auto-apply)."
  );

  return {
    matched: true,
    intent,
    message: parts.filter(Boolean).join("\n"),
    href: "/dashboard/business-expert",
    requiresConfirmation: false,
    planTitle: run.planDraft?.title ?? null,
  };
}
