/**
 * Validators + intent parsing (B1.X expanded).
 */

import { listBusinessTypeIds, listDomainIds } from "@/lib/business-expert/registry";
import type {
  BusinessIntentKind,
  BusinessObjective,
  BusinessProfile,
  BusinessVenture,
  ValidationIssue,
  ValidationResult,
} from "@/lib/business-expert/types";

const DOMAIN_IDS = new Set(listDomainIds());
const TYPE_IDS = new Set(listBusinessTypeIds());

function issue(code: string, message: string, field?: string): ValidationIssue {
  return { code, message, field };
}

export function validateBusinessProfile(
  profile: Partial<BusinessProfile> | null | undefined
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!profile) {
    return { ok: false, issues: [issue("profile_missing", "Perfil empresarial ausente")] };
  }
  if (profile.kind && profile.kind !== "business_profile") {
    issues.push(
      issue("profile_kind_invalid", "Perfil deve ser business_profile", "kind")
    );
  }
  if (!profile.userId) issues.push(issue("user_required", "userId obrigatório", "userId"));
  if (profile.interestAreas) {
    for (const d of profile.interestAreas) {
      if (!DOMAIN_IDS.has(d)) {
        issues.push(issue("domain_unknown", `Domínio desconhecido: ${d}`, "interestAreas"));
      }
    }
  }
  if (profile.preferredBusinessTypes) {
    for (const t of profile.preferredBusinessTypes) {
      if (!TYPE_IDS.has(t)) {
        issues.push(issue("business_type_unknown", `Tipo desconhecido: ${t}`, "preferredBusinessTypes"));
      }
    }
  }
  for (const key of [
    "identityClaims",
    "personalHealth",
    "relationshipStatus",
    "personalMemories",
    "privateNotesIdentity",
  ]) {
    if (profile && key in (profile as Record<string, unknown>)) {
      issues.push(issue("personal_data_leak", `Campo proibido: ${key}`, key));
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateBusinessObjective(
  objective: Partial<BusinessObjective> | null | undefined
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!objective) return { ok: false, issues: [issue("objective_missing", "Objetivo ausente")] };
  if (!objective.userId) issues.push(issue("user_required", "userId obrigatório", "userId"));
  if (!objective.title?.trim()) issues.push(issue("title_required", "Título obrigatório", "title"));
  return { ok: issues.length === 0, issues };
}

export function validateBusinessVenture(
  venture: Partial<BusinessVenture> | null | undefined
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!venture) return { ok: false, issues: [issue("venture_missing", "Negócio ausente")] };
  if (!venture.userId) issues.push(issue("user_required", "userId obrigatório", "userId"));
  if (!venture.name?.trim()) issues.push(issue("name_required", "Nome obrigatório", "name"));
  if (venture.type && !TYPE_IDS.has(venture.type)) {
    issues.push(issue("business_type_unknown", `Tipo inválido: ${venture.type}`, "type"));
  }
  return { ok: issues.length === 0, issues };
}

export function isBusinessExpertIntentMessage(message: string): boolean {
  const t = message.trim();
  return (
    /quero\s+abrir\s+(um\s+)?neg[oó]cio/i.test(t) ||
    /quero\s+empreender/i.test(t) ||
    /quero\s+ganhar\s+dinheiro/i.test(t) ||
    /quero\s+validar\s+(uma\s+)?ideia/i.test(t) ||
    /quero\s+criar\s+(uma\s+)?empresa/i.test(t) ||
    /quero\s+criar\s+(um\s+)?curso/i.test(t) ||
    /quero\s+vender\s+online/i.test(t) ||
    /quero\s+viver\s+de\s+internet/i.test(t) ||
    /quero\s+vender\s+como\s+afiliad/i.test(t) ||
    /quero\s+criar\s+(um\s+)?produto/i.test(t) ||
    /qual\s+melhor\s+plataforma/i.test(t) ||
    /como\s+criar\s+(um\s+)?produto/i.test(t) ||
    /como\s+vender\s+como\s+afiliad/i.test(t) ||
    /como\s+montar\s+(uma\s+)?oferta/i.test(t) ||
    /como\s+(ganhar|cobrar|encontrar\s+clientes|crescer|escalar|validar)/i.test(t) ||
    /kiwify\s+(ou|vs|versus)\s+hotmart|hotmart\s+(ou|vs)\s+kiwify/i.test(t) ||
    /vale\s+(criar|vender)/i.test(t) ||
    /e\s+se\s+eu\s+(vender|criar|abrir)/i.test(t) ||
    /business\s+expert/i.test(t) ||
    /especialista\s+em\s+neg[oó]cios/i.test(t)
  );
}

export function parseBusinessIntent(message: string): BusinessIntentKind {
  const t = message.trim();
  if (/e\s+se\s+eu|e\s+se\b/i.test(t)) return "scenario";
  if (/kiwify|hotmart|melhor\s+plataforma|plataforma\s+para\s+vender/i.test(t))
    return "platform_compare";
  if (/quero\s+vender\s+como\s+afiliad|como\s+vender\s+como\s+afiliad|vender\s+afiliad/i.test(t))
    return "affiliate";
  if (/quero\s+criar\s+(um\s+)?produto|como\s+criar\s+(um\s+)?produto/i.test(t))
    return "create_product";
  if (/quero\s+criar\s+(um\s+)?curso/i.test(t)) return "create_course";
  if (/quero\s+vender\s+online/i.test(t)) return "sell_online";
  if (/quero\s+viver\s+de\s+internet/i.test(t)) return "live_from_internet";
  if (/quero\s+abrir\s+(um\s+)?neg[oó]cio/i.test(t)) return "open_business";
  if (/quero\s+empreender/i.test(t)) return "start_entrepreneurship";
  if (/quero\s+ganhar\s+dinheiro/i.test(t)) return "make_money";
  if (/quero\s+validar|como\s+validar/i.test(t)) return "validate_idea";
  if (/quero\s+criar\s+(uma\s+)?empresa/i.test(t)) return "create_company";
  if (/como\s+montar\s+(uma\s+)?oferta/i.test(t)) return "build_offer";
  if (/como\s+cobrar/i.test(t)) return "price_help";
  if (/como\s+encontrar\s+clientes/i.test(t)) return "find_clients";
  if (/como\s+crescer|quero\s+crescer/i.test(t)) return "grow";
  if (/como\s+escalar/i.test(t)) return "scale";
  if (/plano|planej/i.test(t)) return "plan";
  if (/vis[aã]o\s+geral|overview/i.test(t)) return "overview";
  if (isBusinessExpertIntentMessage(t)) return "advise";
  return "unknown";
}

export function validateIntentMessage(message: string): ValidationResult {
  if (!message?.trim()) {
    return { ok: false, issues: [issue("message_empty", "Mensagem vazia")] };
  }
  if (!isBusinessExpertIntentMessage(message) && parseBusinessIntent(message) === "unknown") {
    return {
      ok: false,
      issues: [issue("intent_unknown", "Intenção empresarial não reconhecida")],
    };
  }
  return { ok: true, issues: [] };
}
