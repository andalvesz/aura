import type {
  AlveszEvento,
  Conteudo,
  Evento,
  Goal,
  GrowthProfile,
  InstagramMarca,
} from "@/types/database";
import type { ProfileAnalysisResult } from "@/lib/growth/types";
import {
  CONTEUDO_STATUSES,
  computeSocialMetrics,
  getConteudoStatusLabel,
  getFormatoLabel,
  getPlataformaLabel,
  normalizeConteudoStatus,
  type ConteudoStatus,
} from "@/utils/social";
import { GOAL_TIPO_LABELS, getActiveGoals, computeGoalMetrics } from "@/utils/goals";
import { formatBRL, formatDate } from "@/utils/format";
import { todayIsoDate } from "@/utils/health";

export const INSTAGRAM_MARCAS: {
  id: InstagramMarca;
  label: string;
  description: string;
  themes: string[];
}[] = [
  {
    id: "marca_pessoal",
    label: "Marca pessoal",
    description: "Anderson Alves · @and.alvesz",
    themes: [
      "ginástica",
      "dança",
      "Disney/NBA",
      "recuperação do ombro",
      "rotina",
    ],
  },
  {
    id: "alvesz",
    label: "Alvesz Experience",
    description: "Bartender premium e eventos",
    themes: ["casamentos", "drinks", "bastidores", "eventos"],
  },
  {
    id: "consorcios",
    label: "Consórcios",
    description: "Educação financeira e captação",
    themes: ["educação financeira", "imóveis", "veículos"],
  },
];

export const MARCA_LABELS: Record<InstagramMarca, string> = Object.fromEntries(
  INSTAGRAM_MARCAS.map((m) => [m.id, m.label])
) as Record<InstagramMarca, string>;

export function getMarcaThemes(marca: InstagramMarca): string[] {
  return INSTAGRAM_MARCAS.find((m) => m.id === marca)?.themes ?? [];
}

export function filterConteudosByMarca(
  conteudos: Conteudo[],
  marca: InstagramMarca | "all"
): Conteudo[] {
  if (marca === "all") return conteudos;
  return conteudos.filter((c) => c.marca === marca || (!c.marca && marca === "marca_pessoal"));
}

export function getProfileForMarca(
  profiles: GrowthProfile[],
  marca: InstagramMarca
): GrowthProfile | null {
  return profiles.find((p) => p.marca === marca) ?? null;
}

export function parseProfileAnalysis(
  raw: Record<string, unknown> | null
): ProfileAnalysisResult | null {
  if (!raw || typeof raw !== "object") return null;
  const summary = String(raw.summary ?? "");
  if (!summary) return null;
  return {
    summary,
    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.map(String)
      : [],
    improvements: Array.isArray(raw.improvements)
      ? raw.improvements.map(String)
      : [],
    contentIdeas: Array.isArray(raw.contentIdeas)
      ? raw.contentIdeas.map(String)
      : [],
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
  };
}

export function conteudosNoMes(conteudos: Conteudo[], reference = new Date()) {
  const y = reference.getFullYear();
  const m = reference.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const days: { date: string; day: number; items: Conteudo[] }[] = [];

  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(y, m, d).toISOString().slice(0, 10);
    const items = conteudos.filter((c) => {
      if (!c.data_publicacao) return false;
      return new Date(c.data_publicacao).toISOString().slice(0, 10) === date;
    });
    days.push({ date, day: d, items });
  }

  const startPad = (first.getDay() + 6) % 7;
  return { year: y, month: m, days, startPad, monthLabel: formatDate(first.toISOString()) };
}

export function pipelinePorStatus(conteudos: Conteudo[]) {
  const normalized = conteudos.map((c) => ({
    ...c,
    status: normalizeConteudoStatus(c.status),
  }));

  return CONTEUDO_STATUSES.map((s) => ({
    status: s.id as ConteudoStatus,
    label: s.label,
    items: normalized.filter((c) => c.status === s.id),
  }));
}

export type InstagramGrowthSnapshot = {
  goalsLines: string[];
  eventsLines: string[];
  financeLine: string;
  healthLine: string;
  leadsLine: string;
};

export function buildInstagramGrowthSnapshot(params: {
  goals: Goal[];
  eventos: Evento[];
  alveszEventos: AlveszEvento[];
  weekIncome: number;
  workoutsWeek: number;
  leadsCount: number;
}): InstagramGrowthSnapshot {
  const activeGoals = getActiveGoals(params.goals);
  const goalsLines =
    activeGoals.length > 0
      ? activeGoals.slice(0, 4).map((g) => {
          const m = computeGoalMetrics(g);
          return `${GOAL_TIPO_LABELS[g.tipo]} — ${g.titulo}: ${m.pct}%`;
        })
      : ["Nenhuma meta ativa."];

  const today = todayIsoDate();
  const upcoming = [
    ...params.eventos.filter((e) => e.data_inicio.slice(0, 10) >= today).slice(0, 3),
    ...params.alveszEventos
      .filter((e) => (e.data_evento ?? "").slice(0, 10) >= today)
      .slice(0, 2),
  ];

  const eventsLines =
    upcoming.length > 0
      ? upcoming.map((e) => {
          if ("data_inicio" in e) {
            return `${formatDate(e.data_inicio.slice(0, 10))} — ${e.titulo}`;
          }
          const ev = e as AlveszEvento;
          return `${formatDate(ev.data_evento.slice(0, 10))} — ${ev.titulo}`;
        })
      : ["Nenhum evento próximo."];

  return {
    goalsLines,
    eventsLines,
    financeLine: `Receita da semana: ${formatBRL(params.weekIncome)}`,
    healthLine: `Treinos esta semana: ${params.workoutsWeek}`,
    leadsLine: `${params.leadsCount} lead(s) ativos no CRM`,
  };
}

export function buildInstagramExpandedContext(params: {
  conteudos: Conteudo[];
  profiles: GrowthProfile[];
  marca?: InstagramMarca | null;
  snapshot: InstagramGrowthSnapshot;
}): string {
  const { conteudos, profiles, marca, snapshot } = params;
  const filtered = marca ? filterConteudosByMarca(conteudos, marca) : conteudos;
  const metrics = computeSocialMetrics(filtered);
  const profile = marca ? getProfileForMarca(profiles, marca) : null;
  const analysis = profile?.analise ? parseProfileAnalysis(profile.analise) : null;

  const profileBlock = profile
    ? `Perfil @${profile.username}
Bio: ${profile.bio ?? profile.observacoes ?? "—"}
Nicho: ${profile.nicho ?? "—"}
Objetivo: ${profile.objetivo ?? "—"}
Frequência: ${profile.frequencia_conteudo ?? "—"}
${analysis ? `Análise: ${analysis.summary}` : ""}`
    : marca
      ? `Perfil ${MARCA_LABELS[marca]} ainda não cadastrado.`
      : "";

  const conteudoLines = filtered
    .slice(0, 10)
    .map(
      (c) =>
        `* ${c.titulo} | ${getFormatoLabel(c.formato)} | ${getConteudoStatusLabel(normalizeConteudoStatus(c.status))}`
    )
    .join("\n");

  return `## INSTAGRAM INTELIGENTE
${profileBlock ? `\n### PERFIL ATIVO\n${profileBlock}\n` : ""}
### CONTEÚDOS (${filtered.length})
Ideias: ${metrics.ideias} | Produção: ${metrics.emProducao} | Publicados: ${metrics.publicados}
${conteudoLines || "Nenhum conteúdo."}

### DADOS REAIS PARA CONTEÚDO
Metas: ${snapshot.goalsLines.join("; ")}
Eventos: ${snapshot.eventsLines.join("; ")}
${snapshot.financeLine}
${snapshot.healthLine}
${snapshot.leadsLine}`;
}

export function isPostTodayQuery(message: string): boolean {
  const n = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    n.includes("o que devo postar hoje") ||
    n.includes("o que postar hoje") ||
    n.includes("postar hoje") ||
    n.includes("conteudo de hoje") ||
    n.includes("conteúdo de hoje")
  );
}
