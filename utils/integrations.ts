export type IntegrationPlatform = "meta" | "kiwify";

export type MetaCampaignAction =
  | "start"
  | "pause"
  | "resume"
  | "duplicate"
  | "generate_copy"
  | "generate_creative";

export const META_ACTIONS_REQUIRING_APPROVAL = [
  "start",
  "publish",
  "increase_budget",
] as const;

export const META_STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  paused: "Pausada",
  draft: "Rascunho",
  archived: "Arquivada",
  pending_review: "Em revisão",
};

export const INTEGRATION_SECURITY_RULES = [
  "Nunca aumentar orçamento sem aprovação explícita.",
  "Nunca publicar campanha nova sem aprovação.",
  "Campanhas criadas pela Aura começam pausadas.",
  "Todas as ações sensíveis são registradas em logs.",
] as const;

export function formatIntegrationCents(cents: number, currency = "BRL"): string {
  const value = cents / 100;
  if (currency === "USD") return `US$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
