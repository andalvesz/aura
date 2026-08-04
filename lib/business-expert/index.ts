/**
 * Business Expert B1.X — public API (Production Ready).
 */

export * from "@/lib/business-expert/types";
export {
  BUSINESS_KNOWLEDGE_DOMAINS,
  SUPPORTED_BUSINESS_TYPES,
  listKnowledgeDomains,
  getKnowledgeDomain,
  listSupportedBusinessTypes,
  getSupportedBusinessType,
  listDomainIds,
  listBusinessTypeIds,
  ensureBusinessExpertRegistered,
  getBusinessExpertRegistration,
} from "@/lib/business-expert/registry";
export {
  listKnowledgeArticles,
  getKnowledgeArticle,
  knowledgeByDomain,
  knowledgeForBusinessType,
  knowledgeCoverageSummary,
} from "@/lib/business-expert/knowledge";
export {
  listMarketplaces,
  getMarketplace,
  marketplacesForBusinessType,
  marketplacesWithAffiliates,
  compareMarketplaces,
  MARKETPLACE_REGISTRY,
} from "@/lib/business-expert/marketplaces";
export {
  listMarketingChannels,
  getMarketingChannel,
  MARKETING_CHANNEL_REGISTRY,
} from "@/lib/business-expert/marketing-registry";
export {
  listBusinessModes,
  getBusinessMode,
  recommendModes,
  BUSINESS_MODES,
} from "@/lib/business-expert/modes";
export {
  listDigitalBusinesses,
  getDigitalBusiness,
  DIGITAL_BUSINESSES,
} from "@/lib/business-expert/digital-catalog";
export {
  listLocalBusinesses,
  getLocalBusiness,
  LOCAL_BUSINESSES,
} from "@/lib/business-expert/local-catalog";
export {
  listKnowledgePacks,
  getKnowledgePack,
  KNOWLEDGE_PACKS,
} from "@/lib/business-expert/knowledge-packs";
export {
  buildBusinessContext,
  assertNoPersonalIdentityData,
  profileCompleteness,
} from "@/lib/business-expert/context";
export {
  adviseBusiness,
  formatAdvisorMessage,
  listSuggestedBusinessTypesForCapital,
  answerBusinessQuestion,
} from "@/lib/business-expert/advisor";
export {
  draftBusinessPlan,
  draftCompleteBusinessPlan,
  toCorePlanDraftProposal,
} from "@/lib/business-expert/planner";
export { validateBusinessIdea } from "@/lib/business-expert/idea-validator";
export { runAffiliateAssistant } from "@/lib/business-expert/affiliate-assistant";
export { runProductBuilder } from "@/lib/business-expert/product-builder";
export { runLocalBusinessAdvisor } from "@/lib/business-expert/local-advisor";
export {
  compareBusinessOptions,
  draftBusinessScenario,
  detectBusinessOpportunities,
  buildBusinessRecommendations,
  maybeWebResearchForMessage,
  formatComparisonMessage,
} from "@/lib/business-expert/kernel-bridge";
export {
  registerBusinessWebResearchProvider,
  getBusinessWebResearchProvider,
  requestBusinessWebResearch,
  shouldPreferWebResearch,
  createMissingWebResearchProvider,
} from "@/lib/business-expert/web-research-provider";
export {
  validateBusinessProfile,
  validateBusinessObjective,
  validateBusinessVenture,
  isBusinessExpertIntentMessage,
  parseBusinessIntent,
  validateIntentMessage,
} from "@/lib/business-expert/validators";
export {
  createEmptyBusinessExpertState,
  getBusinessExpertState,
  setBusinessExpertState,
  clearBusinessExpertState,
  defaultBusinessProfile,
  ensureBusinessProfile,
  getBusinessProfile,
  upsertBusinessProfile,
  setBusinessMode,
  listObjectivesForUser,
  addBusinessObjective,
  listVenturesForUser,
  addBusinessVenture,
  saveIdeaValidation,
  listIdeasForUser,
  queueKnowledgeIngest,
  listKnowledgeIngests,
} from "@/lib/business-expert/service";
export {
  buildOverview,
  runBusinessExpert,
  getHomeBusinessExpertCard,
  getHomeBusinessWidgets,
  businessExpertDiagnostics,
} from "@/lib/business-expert/business-engine";
export {
  handleBusinessExpertCommand,
  BUSINESS_EXPERT_COMMAND_PATTERNS,
} from "@/lib/business-expert/command-center";
