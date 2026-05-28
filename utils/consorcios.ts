import type { Lead } from "@/types/database";

export const LEAD_STATUSES = [
  { value: "novo", label: "Novo" },
  { value: "contato", label: "Contato" },
  { value: "proposta", label: "Proposta" },
  { value: "fechado", label: "Fechado" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

export function getLeadStatusLabel(status: string) {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function computeLeadFunnel(leads: Lead[]) {
  const total = leads.length || 1;
  return LEAD_STATUSES.map((s) => {
    const count = leads.filter((l) => l.status === s.value).length;
    return {
      stage: s.label,
      status: s.value,
      count,
      pct: Math.round((count / total) * 100),
    };
  });
}

export function filterLeadsToday(leads: Lead[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return leads.filter((l) => new Date(l.created_at) >= start);
}
