import type { Gasto, Trip, TripChecklistItem } from "@/types/database";
import { formatBRL, formatDate } from "@/utils/format";
import {
  DEFAULT_CHECKLIST,
  getTravelTemplate,
  type TravelTemplateChecklistItem,
} from "@/utils/travel-templates";

export const TRIP_STATUSES = [
  { id: "planejando", label: "Planejando" },
  { id: "confirmada", label: "Confirmada" },
  { id: "em_viagem", label: "Em viagem" },
  { id: "concluida", label: "Concluída" },
  { id: "cancelada", label: "Cancelada" },
] as const;

export const CHECKLIST_CATEGORIAS = [
  { id: "documentos", label: "Documentos" },
  { id: "passaporte", label: "Passaporte" },
  { id: "visto", label: "Visto" },
  { id: "ingressos", label: "Ingressos" },
  { id: "hospedagem", label: "Hospedagem" },
  { id: "seguro", label: "Seguro" },
  { id: "transporte", label: "Transporte" },
] as const;

export type ParsedTravelAiResponse = {
  roteiro: { dia: number; titulo: string; atividades: string[] }[];
  checklist: { categoria: string; titulo: string }[];
  estimativa_custos: { item: string; valor: number }[];
  preparacao: string[];
  dicas: string[];
};

export function getTripStatusLabel(status: string): string {
  return TRIP_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function getChecklistCategoriaLabel(categoria: string): string {
  return (
    CHECKLIST_CATEGORIAS.find((c) => c.id === categoria)?.label ?? categoria
  );
}

export function daysUntilTrip(trip: Trip, referenceDate = new Date()): number {
  const today = referenceDate.toISOString().slice(0, 10);
  if (today >= trip.data_ida) {
    if (today <= trip.data_volta) return 0;
    return -1;
  }
  const start = new Date(`${trip.data_ida}T12:00:00`);
  const ref = new Date(`${today}T12:00:00`);
  return Math.ceil((start.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

export function tripDurationDays(trip: Trip): number {
  const start = new Date(`${trip.data_ida}T12:00:00`);
  const end = new Date(`${trip.data_volta}T12:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

export function computeChecklistProgress(items: TripChecklistItem[]): number {
  if (!items.length) return 0;
  const done = items.filter((i) => i.status === "feito").length;
  return Math.round((done / items.length) * 100);
}

export function computeBudgetProgress(trip: Trip): number {
  if (!trip.orcamento || trip.orcamento <= 0) return 0;
  return Math.min(100, Math.round((trip.gasto_atual / trip.orcamento) * 100));
}

export function formatTripDateRange(trip: Trip): string {
  return `${formatDate(trip.data_ida)} — ${formatDate(trip.data_volta)}`;
}

export function formatBudgetSummary(trip: Trip): string {
  return `${formatBRL(trip.gasto_atual)} de ${formatBRL(trip.orcamento)}`;
}

export function resolveChecklistSeed(
  templateId: string | null | undefined
): TravelTemplateChecklistItem[] {
  const template = getTravelTemplate(templateId);
  return template?.checklist ?? DEFAULT_CHECKLIST;
}

export function groupChecklistByCategoria(
  items: TripChecklistItem[]
): Record<string, TripChecklistItem[]> {
  const groups: Record<string, TripChecklistItem[]> = {};
  for (const item of items) {
    if (!groups[item.categoria]) groups[item.categoria] = [];
    groups[item.categoria].push(item);
  }
  return groups;
}

export function activeTrips(trips: Trip[]): Trip[] {
  return trips.filter((t) => t.status !== "cancelada" && t.status !== "concluida");
}

export function upcomingTrip(trips: Trip[]): Trip | null {
  const active = activeTrips(trips);
  const future = active
    .filter((t) => daysUntilTrip(t) >= 0)
    .sort((a, b) => a.data_ida.localeCompare(b.data_ida));
  return future[0] ?? active[0] ?? null;
}

export function viagemGastos(gastos: Gasto[], trip: Trip): Gasto[] {
  return gastos.filter(
    (g) =>
      g.categoria.toLowerCase().includes("viagem") &&
      g.data >= trip.data_ida &&
      g.data <= trip.data_volta
  );
}

export function sumViagemGastos(gastos: Gasto[], trip: Trip): number {
  return viagemGastos(gastos, trip).reduce((s, g) => s + Number(g.valor), 0);
}

export function isValidChecklistCategoria(
  value: string
): value is TripChecklistItem["categoria"] {
  return CHECKLIST_CATEGORIAS.some((c) => c.id === value);
}

export function parseTravelAiResponse(raw: Partial<ParsedTravelAiResponse>): ParsedTravelAiResponse {
  return {
    roteiro: Array.isArray(raw.roteiro)
      ? raw.roteiro.map((d) => ({
          dia: Number(d.dia) || 1,
          titulo: String(d.titulo ?? "").trim(),
          atividades: Array.isArray(d.atividades)
            ? d.atividades.map((a) => String(a).trim()).filter(Boolean)
            : [],
        }))
      : [],
    checklist: Array.isArray(raw.checklist)
      ? raw.checklist
          .map((c) => ({
            categoria: String(c.categoria ?? "documentos").toLowerCase(),
            titulo: String(c.titulo ?? "").trim(),
          }))
          .filter((c) => c.titulo)
      : [],
    estimativa_custos: Array.isArray(raw.estimativa_custos)
      ? raw.estimativa_custos.map((e) => ({
          item: String(e.item ?? "").trim(),
          valor: Number(e.valor) || 0,
        }))
      : [],
    preparacao: Array.isArray(raw.preparacao)
      ? raw.preparacao.map((p) => String(p).trim()).filter(Boolean)
      : [],
    dicas: Array.isArray(raw.dicas)
      ? raw.dicas.map((d) => String(d).trim()).filter(Boolean)
      : [],
  };
}
