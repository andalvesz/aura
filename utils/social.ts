import type { Conteudo, GrowthLead, GrowthProfile } from "@/types/database";
import {
  analyzeGrowthLeadContentInsights,
  type GrowthContentInsights,
} from "@/utils/growth";

export const CONTEUDO_STATUSES = [
  { id: "ideia", label: "Ideia" },
  { id: "roteiro", label: "Roteiro" },
  { id: "gravado", label: "Gravado" },
  { id: "editado", label: "Editado" },
  { id: "publicado", label: "Publicado" },
] as const;

export type ConteudoStatus = (typeof CONTEUDO_STATUSES)[number]["id"];

export const CONTEUDO_PLATAFORMAS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
] as const;

export type ConteudoPlataforma = (typeof CONTEUDO_PLATAFORMAS)[number];

export const CONTEUDO_FORMATOS = [
  "reel",
  "story",
  "post",
  "short",
  "video_longo",
] as const;

export type ConteudoFormato = (typeof CONTEUDO_FORMATOS)[number];

export const SOCIAL_AI_ACTIONS = [
  "criar-roteiro-reels",
  "calendario-semana",
  "ideias-alvesz",
  "ideias-consorcios",
  "ideias-marca-pessoal",
  "lead-para-conteudo",
] as const;

export type SocialAiAction = (typeof SOCIAL_AI_ACTIONS)[number];

export function isSocialAiAction(actionId: string): actionId is SocialAiAction {
  return SOCIAL_AI_ACTIONS.includes(actionId as SocialAiAction);
}

export const SOCIAL_AI_CONTEXT = `Você é a IA de Social Media do Anderson Alves — assistente para planejar, criar roteiros e acompanhar conteúdos.

## MARCAS E NEGÓCIOS

**Anderson Alves (marca pessoal)**
- Indaiatuba, SP · @and.alvesz
- Dança, ginástica, teatro, recuperação do ombro, rotina de atleta
- Disney, NBA, vida como série, storytelling pessoal
- Objetivo: crescer marca pessoal e autoridade

**Alvesz Experience**
- Bartender premium, drinks autorais, bar para eventos
- Casamentos, aniversários, eventos corporativos, formaturas
- Captação via Instagram e WhatsApp

**Consórcios (Ademicon)**
- Imóveis, veículos, investimentos, educação financeira
- Conteúdo educativo que gera confiança e leads qualificados

## PLATAFORMAS
Instagram, TikTok, YouTube, Facebook

## FORMATOS
Reel, Story, Post, Short, Vídeo longo

## REGRAS
- Responda em português do Brasil, tom prático e direto
- Foque em conversão: DM, WhatsApp, agendamento
- Use ganchos fortes nos primeiros 3 segundos (Reels/Shorts)
- Nunca invente métricas ou leads — use apenas os dados fornecidos`;

export const SOCIAL_ROTEIRO_CONTEXT = `${SOCIAL_AI_CONTEXT}

Estruture roteiros com: gancho, desenvolvimento, CTA e hashtags sugeridas.`;

const PLATAFORMA_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
};

const FORMATO_LABELS: Record<string, string> = {
  reel: "Reel",
  reels: "Reel",
  story: "Story",
  stories: "Story",
  post: "Post",
  short: "Short",
  video_longo: "Vídeo longo",
  carrossel: "Post",
  live: "Post",
};

export function getConteudoStatusLabel(status: string) {
  return CONTEUDO_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function getPlataformaLabel(plataforma: string) {
  return PLATAFORMA_LABELS[plataforma] ?? plataforma;
}

export function getFormatoLabel(formato: string | null) {
  if (!formato) return "—";
  return FORMATO_LABELS[formato] ?? formato;
}

export function normalizeConteudoStatus(status: string): ConteudoStatus {
  const map: Record<string, ConteudoStatus> = {
    ideia: "ideia",
    planejado: "roteiro",
    analise: "ideia",
    roteiro: "roteiro",
    gravado: "gravado",
    editado: "editado",
    publicado: "publicado",
  };
  return map[status] ?? "ideia";
}

export function normalizeConteudoFormato(formato: string | null): ConteudoFormato {
  const map: Record<string, ConteudoFormato> = {
    reel: "reel",
    reels: "reel",
    story: "story",
    stories: "story",
    post: "post",
    short: "short",
    video_longo: "video_longo",
    carrossel: "post",
    live: "post",
  };
  if (!formato) return "reel";
  return map[formato] ?? "reel";
}

export function computeSocialMetrics(conteudos: Conteudo[]) {
  const normalized = conteudos.map((c) => ({
    ...c,
    status: normalizeConteudoStatus(c.status),
  }));

  const ideias = normalized.filter((c) => c.status === "ideia").length;
  const publicados = normalized.filter((c) => c.status === "publicado").length;
  const emProducao = normalized.filter((c) =>
    ["roteiro", "gravado", "editado"].includes(c.status)
  ).length;

  const porPlataforma = CONTEUDO_PLATAFORMAS.reduce(
    (acc, p) => {
      const items = normalized.filter((c) => c.plataforma === p);
      acc[p] = {
        planejados: items.filter((c) => c.status !== "publicado").length,
        publicados: items.filter((c) => c.status === "publicado").length,
      };
      return acc;
    },
    {} as Record<string, { planejados: number; publicados: number }>
  );

  return { ideias, publicados, emProducao, porPlataforma, normalized };
}

export function conteudosNaSemana(conteudos: Conteudo[]) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);

  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return dias.map((day, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const items = conteudos.filter((c) => {
      if (!c.data_publicacao) return false;
      return new Date(c.data_publicacao).toISOString().slice(0, 10) === key;
    });
    return { day, date: key, items };
  });
}

export type ParsedConteudoSuggestion = {
  titulo: string;
  plataforma: string;
  formato: string;
  objetivo: string | null;
  data: string | null;
  roteiro: string | null;
  observacoes: string | null;
};

function parseSuggestionRow(row: Record<string, unknown>): ParsedConteudoSuggestion | null {
  const titulo = String(row.titulo ?? row.title ?? "").trim();
  if (!titulo) return null;

  return {
    titulo,
    plataforma: String(row.plataforma ?? "instagram"),
    formato: normalizeConteudoFormato(
      row.formato != null ? String(row.formato) : null
    ),
    objetivo: row.objetivo != null ? String(row.objetivo).trim() || null : null,
    data: row.data != null ? String(row.data).slice(0, 10) : null,
    roteiro: row.roteiro != null ? String(row.roteiro).trim() || null : null,
    observacoes: row.observacoes != null ? String(row.observacoes).trim() || null : null,
  };
}

export function parseConteudoSuggestions(raw: unknown): ParsedConteudoSuggestion[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj.conteudos)
    ? obj.conteudos
    : Array.isArray(obj.ideias)
      ? obj.ideias
      : [];

  return list
    .map((item) =>
      typeof item === "object" && item !== null
        ? parseSuggestionRow(item as Record<string, unknown>)
        : null
    )
    .filter((item): item is ParsedConteudoSuggestion => item !== null);
}

export function getSocialGrowthHints(insights: GrowthContentInsights): string[] {
  const hints: string[] = [];

  const casamentos = insights.nichos.find((n) => n.label === "Casamentos");
  if (casamentos && casamentos.count > 0) {
    hints.push(
      `${casamentos.count} lead(s) de casamento — sugira conteúdo sobre bartender para casamentos e Alvesz Experience.`
    );
  }

  if (insights.temLeadsConsorcio) {
    hints.push(
      `${insights.leadsConsorcio.length} lead(s) de consórcio — sugira conteúdo educativo sobre imóveis, veículos e investimentos.`
    );
  }

  if (insights.maiorDemanda && insights.maiorDemanda !== "Outros") {
    hints.push(`Maior demanda no CRM: ${insights.maiorDemanda}.`);
  }

  return hints;
}

export function buildSocialIaDataContext(params: {
  conteudos: Conteudo[];
  profiles: GrowthProfile[];
  leads: GrowthLead[];
}): string {
  const { conteudos, profiles, leads } = params;
  const metrics = computeSocialMetrics(conteudos);
  const insights = analyzeGrowthLeadContentInsights(leads);

  const conteudoLines =
    conteudos.length > 0
      ? metrics.normalized
          .slice(0, 12)
          .map(
            (c) =>
              `* ${c.titulo} | ${getPlataformaLabel(c.plataforma)} | ${getConteudoStatusLabel(c.status)}${c.data_publicacao ? ` | ${c.data_publicacao.slice(0, 10)}` : ""}`
          )
          .join("\n")
      : "Nenhum conteúdo cadastrado.";

  const profileLines =
    profiles.length > 0
      ? profiles
          .map(
            (p) =>
              `* @${p.username} (${getPlataformaLabel(p.plataforma)})${p.nicho ? ` — nicho: ${p.nicho}` : ""}${p.objetivo ? ` — objetivo: ${p.objetivo}` : ""}`
          )
          .join("\n")
      : "Nenhum perfil cadastrado em growth_profiles.";

  const nicheLines =
    insights.nichos.length > 0
      ? insights.nichos.map((n) => `* ${n.count} ${n.label}`).join("\n")
      : "Sem leads para inferir nichos.";

  const leadLines =
    leads.length > 0
      ? leads
          .slice(0, 8)
          .map(
            (l) =>
              `* ${l.nome} | ${l.vertical ?? "—"} | ${l.status}${l.observacoes ? ` | ${l.observacoes.slice(0, 60)}` : ""}`
          )
          .join("\n")
      : "Nenhum lead no CRM.";

  const hints = getSocialGrowthHints(insights);
  const hintsBlock =
    hints.length > 0
      ? `\n## SUGESTÕES AUTOMÁTICAS (CRM)\n${hints.map((h) => `* ${h}`).join("\n")}`
      : "";

  return `## CONTEÚDOS CADASTRADOS (tabela conteudos — Supabase)
Total: ${conteudos.length} | Ideias: ${metrics.ideias} | Em produção: ${metrics.emProducao} | Publicados: ${metrics.publicados}

${conteudoLines}

## PERFIS DE CRESCIMENTO (growth_profiles)
${profileLines}

## LEADS DO CRM (growth_leads)
${leadLines}

## INSIGHTS DE DEMANDA (derivados dos leads)
Nichos:
${nicheLines}
Maior demanda: ${insights.maiorDemanda ?? "Sem dados"}${hintsBlock}`;
}
