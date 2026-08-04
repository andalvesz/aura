/**
 * Business Expert engine B1.X — orchestrates assistants + kernel bridges.
 */

import { adviseBusiness, answerBusinessQuestion } from "@/lib/business-expert/advisor";
import { runAffiliateAssistant } from "@/lib/business-expert/affiliate-assistant";
import {
  buildBusinessContext,
  profileCompleteness,
} from "@/lib/business-expert/context";
import { validateBusinessIdea } from "@/lib/business-expert/idea-validator";
import {
  buildBusinessRecommendations,
  compareBusinessOptions,
  detectBusinessOpportunities,
  draftBusinessScenario,
  maybeWebResearchForMessage,
} from "@/lib/business-expert/kernel-bridge";
import { listKnowledgeArticles } from "@/lib/business-expert/knowledge";
import { listKnowledgePacks } from "@/lib/business-expert/knowledge-packs";
import { runLocalBusinessAdvisor } from "@/lib/business-expert/local-advisor";
import { draftBusinessPlan } from "@/lib/business-expert/planner";
import { runProductBuilder } from "@/lib/business-expert/product-builder";
import {
  ensureBusinessExpertRegistered,
  listBusinessTypeIds,
  listDomainIds,
} from "@/lib/business-expert/registry";
import { listMarketplaces } from "@/lib/business-expert/marketplaces";
import { listBusinessModes } from "@/lib/business-expert/modes";
import {
  ensureBusinessProfile,
  listIdeasForUser,
  listObjectivesForUser,
  listVenturesForUser,
  saveIdeaValidation,
  getBusinessExpertState,
} from "@/lib/business-expert/service";
import type {
  BusinessExpertOverview,
  BusinessExpertRunInput,
  BusinessExpertRunResult,
  BusinessIntentKind,
  HomeBusinessWidgets,
} from "@/lib/business-expert/types";
import { parseBusinessIntent } from "@/lib/business-expert/validators";

export function buildOverview(
  userId: string,
  now?: string
): BusinessExpertOverview {
  ensureBusinessExpertRegistered();
  const profile = ensureBusinessProfile(userId, now);
  const objectives = listObjectivesForUser(userId);
  const ventures = listVenturesForUser(userId);
  const completeness = profileCompleteness(profile);
  const gaps: string[] = [];
  if (completeness < 60) gaps.push("profile_incomplete");
  if (!objectives.length && !profile.objectives.length) gaps.push("no_objectives");
  if (!ventures.length) gaps.push("no_ventures");

  return {
    version: "1.1.0",
    capabilityId: "module.business-expert",
    skillId: "skill.business-expert",
    category: "Business Intelligence",
    profileCompleteness: completeness,
    domainCount: listDomainIds().length,
    businessTypeCount: listBusinessTypeIds().length,
    marketplaceCount: listMarketplaces().length,
    modeCount: listBusinessModes().length,
    objectiveCount: objectives.length || profile.objectives.length,
    ventureCount: ventures.length || profile.currentBusinesses.length,
    knowledgeCount: listKnowledgeArticles().length,
    packCount: listKnowledgePacks().length,
    gaps,
    nextActions: [
      completeness < 80 ? "Completar Perfil Empresarial" : "Escolher modo de negócio",
      "Validar ideia ou abrir Affiliate/Product Builder",
      "Gerar plano completo no Planner",
    ],
  };
}

export function runBusinessExpert(
  input: BusinessExpertRunInput
): BusinessExpertRunResult {
  ensureBusinessExpertRegistered();
  const now = input.now ?? new Date().toISOString();
  const profile = ensureBusinessProfile(input.userId, now);
  const objectives = listObjectivesForUser(input.userId);
  const ventures = listVenturesForUser(input.userId);
  const context = buildBusinessContext({ profile, objectives, ventures, now });

  const message = input.message ?? "";
  const intent: BusinessIntentKind =
    input.intent ??
    (message ? parseBusinessIntent(message) : "overview");

  const advisor =
    message && intent === "advise"
      ? answerBusinessQuestion(message, context)
      : adviseBusiness(intent, context, message);

  const planIntents = new Set<BusinessIntentKind>([
    "open_business",
    "start_entrepreneurship",
    "make_money",
    "validate_idea",
    "create_company",
    "create_course",
    "sell_online",
    "live_from_internet",
    "affiliate",
    "create_product",
    "grow",
    "scale",
    "build_offer",
    "plan",
  ]);

  let planDraft = planIntents.has(intent)
    ? draftBusinessPlan(intent, context)
    : null;

  let ideaValidation = null;
  if (intent === "validate_idea" || input.ideaInput) {
    ideaValidation = validateBusinessIdea(
      input.ideaInput ?? {
        idea: message || "Ideia a validar",
        capital: profile.capital,
        time: profile.availability,
        experience: profile.experience,
      }
    );
    saveIdeaValidation(input.userId, ideaValidation, now);
  }

  let affiliate = null;
  if (intent === "affiliate" || input.affiliateIntake) {
    affiliate = runAffiliateAssistant(
      input.affiliateIntake ?? {
        timeAvailable: profile.availability,
        capital: profile.capital,
        experience: profile.experience,
      },
      context
    );
    if (affiliate.plan) planDraft = affiliate.plan;
  }

  let product = null;
  if (intent === "create_product" || intent === "create_course" || input.productIntake) {
    product = runProductBuilder(input.productIntake ?? {}, context);
    if (product.plan) planDraft = product.plan;
  }

  let local = null;
  if (intent === "open_business" || input.localIntake) {
    local = runLocalBusinessAdvisor(
      input.localIntake ?? {
        capital: profile.capital,
        time: profile.availability,
      },
      context
    );
    if (local.complete && local.plan) planDraft = local.plan;
  }

  const comparison = message ? compareBusinessOptions(message) : null;
  const scenario =
    intent === "scenario" || /e\s+se/i.test(message)
      ? draftBusinessScenario(message || "E se eu empreender?")
      : null;
  const opportunities = detectBusinessOpportunities(context);
  const recommendations = buildBusinessRecommendations(context);
  const webResearch = message ? maybeWebResearchForMessage(message) : null;

  return {
    overview: buildOverview(input.userId, now),
    context,
    advisor,
    planDraft,
    ideaValidation,
    affiliate,
    product,
    local,
    comparison,
    opportunities,
    recommendations,
    scenario,
    webResearch,
    learningSignal: {
      sourceLayer: "business-expert",
      event: `intent:${intent}`,
      summary: advisor.summary.slice(0, 200),
    },
  };
}

export function getHomeBusinessExpertCard(userId: string) {
  const overview = buildOverview(userId);
  return {
    title: "Business Expert",
    subtitle: "Consultor empresarial production-ready",
    href: "/dashboard/business-expert",
    completeness: overview.profileCompleteness,
    gaps: overview.gaps.length,
    nextAction: overview.nextActions[0] ?? "Abrir Business Expert",
  };
}

export function getHomeBusinessWidgets(userId: string): HomeBusinessWidgets {
  const run = runBusinessExpert({ userId, intent: "overview" });
  const ideas = listIdeasForUser(userId);
  return {
    opportunities: run.opportunities,
    businesses: run.context.ventures,
    markets: run.context.activeDomains.slice(0, 5).map(String),
    ideas: ideas.map((i) => ({ id: i.id, idea: i.idea, score: i.score })),
    projects: run.planDraft
      ? [run.planDraft.projectOutline]
      : run.context.ventures.map((v) => ({
          name: v.name,
          description: v.summary || v.type,
        })),
  };
}

export function businessExpertDiagnostics() {
  const reg = ensureBusinessExpertRegistered();
  const state = getBusinessExpertState();
  return {
    registered: reg,
    profiles: state.profiles.length,
    objectives: state.objectives.length,
    ventures: state.ventures.length,
    ideas: state.ideas.length,
    knowledge: listKnowledgeArticles().length,
  };
}
