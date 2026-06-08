import type { Conteudo, InstagramMarca } from "@/types/database";
import { filterConteudosByMarca } from "@/utils/instagram";
import {
  CONTEUDO_FORMATOS,
  CONTEUDO_PLATAFORMAS,
  CONTEUDO_STATUSES,
  getConteudoPublishedDate,
  normalizeConteudoFormato,
  normalizeConteudoStatus,
  type ConteudoStatus,
} from "@/utils/social";

export type SocialPeriodFilter = "all" | "semana" | "mes";

export type SocialContentFilters = {
  marca: InstagramMarca | "all";
  plataforma: string;
  status: ConteudoStatus | "all";
  formato: string;
  periodo: SocialPeriodFilter;
  search: string;
};

export const DEFAULT_SOCIAL_FILTERS: SocialContentFilters = {
  marca: "all",
  plataforma: "all",
  status: "all",
  formato: "all",
  periodo: "all",
  search: "",
};

function getWeekRange(reference = new Date()) {
  const start = new Date(reference);
  start.setDate(reference.getDate() - ((reference.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getEditorialDate(conteudo: Conteudo): string {
  return conteudo.data_publicacao?.slice(0, 10) ?? conteudo.created_at.slice(0, 10);
}

function isDateInRange(isoDate: string, start: Date, end: Date): boolean {
  const d = new Date(`${isoDate}T12:00:00`);
  return d >= start && d <= end;
}

export function matchesSocialPeriod(
  conteudo: Conteudo,
  periodo: SocialPeriodFilter,
  reference = new Date()
): boolean {
  if (periodo === "all") return true;

  const dateStr = getEditorialDate(conteudo);
  const range = periodo === "semana" ? getWeekRange(reference) : getMonthRange(reference);
  return isDateInRange(dateStr, range.start, range.end);
}

export function searchConteudoText(conteudo: Conteudo, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const fields = [
    conteudo.titulo,
    conteudo.objetivo,
    conteudo.observacoes,
    conteudo.roteiro,
  ];

  return fields.some((f) => f?.toLowerCase().includes(q));
}

export function filterConteudosSocial(
  conteudos: Conteudo[],
  filters: SocialContentFilters,
  reference = new Date()
): Conteudo[] {
  return conteudos.filter((c) => {
    if (filters.marca !== "all") {
      const marcaMatch =
        c.marca === filters.marca ||
        (!c.marca && filters.marca === "marca_pessoal");
      if (!marcaMatch) return false;
    }

    if (filters.plataforma !== "all" && c.plataforma !== filters.plataforma) {
      return false;
    }

    if (
      filters.status !== "all" &&
      normalizeConteudoStatus(c.status) !== filters.status
    ) {
      return false;
    }

    if (filters.formato !== "all") {
      const fmt = normalizeConteudoFormato(c.formato);
      if (fmt !== filters.formato) return false;
    }

    if (!matchesSocialPeriod(c, filters.periodo, reference)) {
      return false;
    }

    if (!searchConteudoText(c, filters.search)) {
      return false;
    }

    return true;
  });
}

export function countConteudosPlanejados(
  conteudos: Conteudo[],
  periodo: "semana" | "mes",
  marca?: InstagramMarca | "all"
): number {
  const base = marca && marca !== "all" ? filterConteudosByMarca(conteudos, marca) : conteudos;
  return base.filter(
    (c) =>
      Boolean(c.data_publicacao) &&
      normalizeConteudoStatus(c.status) !== "publicado" &&
      matchesSocialPeriod(c, periodo)
  ).length;
}

export function countConteudosPublicados(
  conteudos: Conteudo[],
  periodo: "semana" | "mes",
  marca?: InstagramMarca | "all"
): number {
  const base = marca && marca !== "all" ? filterConteudosByMarca(conteudos, marca) : conteudos;
  const range = periodo === "semana" ? getWeekRange() : getMonthRange();

  return base.filter((c) => {
    if (normalizeConteudoStatus(c.status) !== "publicado") return false;
    const published = getConteudoPublishedDate(c).slice(0, 10);
    return isDateInRange(published, range.start, range.end);
  }).length;
}

export const SOCIAL_FILTER_OPTIONS = {
  plataformas: [{ id: "all", label: "Todas" }, ...CONTEUDO_PLATAFORMAS.map((p) => ({ id: p, label: p }))],
  statuses: [{ id: "all", label: "Todos" }, ...CONTEUDO_STATUSES.map((s) => ({ id: s.id, label: s.label }))],
  formatos: [{ id: "all", label: "Todos" }, ...CONTEUDO_FORMATOS.map((f) => ({ id: f, label: f }))],
  periodos: [
    { id: "all", label: "Todo período" },
    { id: "semana", label: "Esta semana" },
    { id: "mes", label: "Este mês" },
  ] as const,
};
