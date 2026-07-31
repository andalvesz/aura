/**
 * SaaS readiness gap checklist (audit, not billing).
 */

export type SaasGap = {
  area: string;
  status: "ready" | "partial" | "gap";
  notes: string;
};

export function saasReadinessGaps(): SaasGap[] {
  return [
    {
      area: "user_hardcodes",
      status: "partial",
      notes: "Fallbacks de display name ainda existem em APIs legadas; Identity cobre o caminho novo.",
    },
    {
      area: "tenant_isolation",
      status: "ready",
      notes: "Workspaces + RLS; capabilities privadas por slug.",
    },
    {
      area: "optional_modules",
      status: "ready",
      notes: "Capability Registry classifica core vs optional.",
    },
    {
      area: "branding",
      status: "partial",
      notes: "Branding básico por workspace; white-label completo não implementado.",
    },
    {
      area: "limits",
      status: "partial",
      notes: "Limites técnicos declarados; sem enforcement comercial.",
    },
    {
      area: "configuration",
      status: "ready",
      notes: "Export/import versionado e Skill Center.",
    },
    {
      area: "onboarding",
      status: "ready",
      notes: "Onboarding pessoal e de workspace sem mock data.",
    },
    {
      area: "feature_flags",
      status: "ready",
      notes: "Flags por escopo; não substituem auth.",
    },
    {
      area: "logs",
      status: "ready",
      notes: "Platform audit events sem dados sensíveis.",
    },
    {
      area: "migrations",
      status: "partial",
      notes: "SQL preparado; não aplicar automaticamente em produção.",
    },
    {
      area: "storage",
      status: "partial",
      notes: "Metering de storage; políticas de bucket por tenant ainda evoluem.",
    },
    {
      area: "rls",
      status: "ready",
      notes: "Policies nas tabelas da sprint 10.0.",
    },
    {
      area: "permissions",
      status: "ready",
      notes: "Roles + capability permissions.",
    },
    {
      area: "service_role",
      status: "partial",
      notes: "Uso existente auditado; platform APIs devem evitar service role no client.",
    },
    {
      area: "external_costs",
      status: "gap",
      notes: "Provider calls metered; orçamento por tenant ainda não.",
    },
    {
      area: "rate_limiting",
      status: "gap",
      notes: "Limits declarados; rate limiting HTTP global pendente.",
    },
    {
      area: "billing",
      status: "gap",
      notes: "Propositalmente fora da Sprint 10.0.",
    },
  ];
}
