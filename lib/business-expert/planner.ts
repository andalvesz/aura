/**
 * Business plan drafts for the existing core Planner (B1.X).
 * Re-exports complete planner + intent-based helper.
 */

import { draftCompleteBusinessPlan, toCorePlanDraftProposal } from "@/lib/business-expert/complete-planner";
import type {
  BusinessContext,
  BusinessIntentKind,
  BusinessPlanDraft,
} from "@/lib/business-expert/types";

export { draftCompleteBusinessPlan, toCorePlanDraftProposal };

const TITLE: Partial<Record<BusinessIntentKind, string>> = {
  open_business: "Plano: abrir um negócio",
  start_entrepreneurship: "Plano: jornada empreendedora",
  make_money: "Plano: primeira monetização",
  validate_idea: "Plano: validar ideia",
  create_company: "Plano: preparar empresa",
  create_course: "Plano: criar curso",
  sell_online: "Plano: vender online",
  live_from_internet: "Plano: viver de internet",
  affiliate: "Plano: vender como afiliado",
  create_product: "Plano: criar produto",
  grow: "Plano: crescimento",
  scale: "Plano: escala",
  build_offer: "Plano: montar oferta",
  plan: "Plano empresarial",
  platform_compare: "Plano: decidir plataforma",
};

export function draftBusinessPlan(
  intent: BusinessIntentKind,
  ctx: BusinessContext
): BusinessPlanDraft {
  return draftCompleteBusinessPlan({
    intent,
    title: TITLE[intent] ?? "Plano Business Expert",
    objective: `Avançar ${intent} com perfil empresarial ${ctx.userId}`,
    mode: ctx.activeMode,
    context: ctx,
  });
}
