import type {
  AlveszEvento,
  Conteudo,
  Evento,
  Goal,
  InstagramMarca,
  LanguageProgress,
  LanguageSession,
  Lead,
  Orcamento,
  Trip,
  TripChecklistItem,
} from "@/types/database";
import { DISNEY_NBA_TEMPLATE_ID } from "@/utils/disney-nba";
import { getLeadStatusLabel } from "@/utils/consorcios";
import { normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import { computeGoalMetrics, getActiveGoals, isGoalBehind } from "@/utils/goals";
import { filterConteudosByMarca } from "@/utils/instagram";
import {
  getConteudoPublishedDate,
  normalizeConteudoFormato,
  normalizeConteudoStatus,
  type ConteudoFormato,
} from "@/utils/social";
import { daysUntilTrip } from "@/utils/travel";
import { todayIsoDate } from "@/utils/health";

export type SocialOpportunitySource =
  | "alvesz_evento"
  | "alvesz_orcamento"
  | "alvesz_concluido"
  | "consorcios_lead"
  | "viagem"
  | "disney_nba"
  | "english"
  | "evento"
  | "meta"
  | "calendario";

export type SocialOpportunityCategory =
  | "reel"
  | "story"
  | "bastidores"
  | "depoimento"
  | "autoridade"
  | "objecao"
  | "prova_social"
  | "jornada"
  | "preparacao"
  | "ingles"
  | "geral";

export type SocialOpportunity = {
  id: string;
  source: SocialOpportunitySource;
  sourceLabel: string;
  titulo: string;
  descricao: string;
  formato: ConteudoFormato;
  marca: InstagramMarca;
  prioridade: "alta" | "media" | "baixa";
  categoria: SocialOpportunityCategory;
};

export type SocialReport = {
  planejado: number;
  publicado: number;
  atrasado: number;
  taxaExecucao: number;
  emProducao: number;
};

export type PostingStreakInfo = {
  diasSemPostar: number;
  sequenciaAtual: number;
  ultimaPublicacao: string | null;
  publicouHoje: boolean;
};

const UPCOMING_DAYS = 30;
const RECENT_COMPLETED_DAYS = 14;

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T12:00:00`);
  const db = new Date(`${b.slice(0, 10)}T12:00:00`);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function isUpcoming(dateStr: string | null | undefined, withinDays = UPCOMING_DAYS): boolean {
  if (!dateStr) return false;
  const today = todayIsoDate();
  const d = dateStr.slice(0, 10);
  if (d < today) return false;
  return daysBetween(today, d) <= withinDays;
}

function isRecent(dateStr: string | null | undefined, withinDays = RECENT_COMPLETED_DAYS): boolean {
  if (!dateStr) return false;
  const today = todayIsoDate();
  const d = dateStr.slice(0, 10);
  if (d > today) return false;
  return daysBetween(d, today) <= withinDays;
}

function makeId(parts: string[]): string {
  return parts.join(":");
}

export function buildAlveszOpportunities(params: {
  orcamentos: Orcamento[];
  alveszEventos: AlveszEvento[];
  eventos: Evento[];
}): SocialOpportunity[] {
  const { orcamentos, alveszEventos, eventos } = params;
  const opportunities: SocialOpportunity[] = [];

  for (const orc of orcamentos) {
    const status = normalizeOrcamentoStatus(orc.status);

    if (status === "fechado") {
      opportunities.push({
        id: makeId(["alvesz-orc-fechado", orc.id]),
        source: "alvesz_orcamento",
        sourceLabel: "Alvesz · Orçamento fechado",
        titulo: `Celebrar fechamento: ${orc.tipo_evento}`,
        descricao: `Orçamento fechado para ${orc.tipo_evento} (${orc.convidados} convidados). Grave bastidores da preparação e um Reel de autoridade sobre o serviço.`,
        formato: "reel",
        marca: "alvesz",
        prioridade: "alta",
        categoria: "bastidores",
      });
      opportunities.push({
        id: makeId(["alvesz-orc-story", orc.id]),
        source: "alvesz_orcamento",
        sourceLabel: "Alvesz · Orçamento fechado",
        titulo: `Story: mais um evento confirmado`,
        descricao: `Conte a novidade do fechamento de ${orc.tipo_evento} sem expor dados do cliente. Use CTA para orçamento.`,
        formato: "story",
        marca: "alvesz",
        prioridade: "media",
        categoria: "story",
      });
    }

    if (isUpcoming(orc.data_evento)) {
      const days = daysBetween(todayIsoDate(), orc.data_evento!.slice(0, 10));
      opportunities.push({
        id: makeId(["alvesz-evento-prox", orc.id]),
        source: "alvesz_evento",
        sourceLabel: "Alvesz · Evento próximo",
        titulo: `Countdown: ${orc.tipo_evento} em ${days} dia(s)`,
        descricao: `Evento ${orc.tipo_evento} em ${orc.local ?? "local a definir"}. Prepare Reels de bastidores, montagem do bar e stories do dia.`,
        formato: "reel",
        marca: "alvesz",
        prioridade: days <= 7 ? "alta" : "media",
        categoria: "bastidores",
      });
    }
  }

  for (const ev of alveszEventos) {
    if (isUpcoming(ev.data_evento)) {
      const days = daysBetween(todayIsoDate(), ev.data_evento.slice(0, 10));
      opportunities.push({
        id: makeId(["alvesz-ev-prox", ev.id]),
        source: "alvesz_evento",
        sourceLabel: "Alvesz · Evento confirmado",
        titulo: `Preparar conteúdo: ${ev.titulo}`,
        descricao: `Evento confirmado em ${days} dia(s). Grave bastidores, drinks autorais e depoimentos do cliente.`,
        formato: "reel",
        marca: "alvesz",
        prioridade: days <= 7 ? "alta" : "media",
        categoria: "bastidores",
      });
    }

    if (isRecent(ev.data_evento)) {
      opportunities.push({
        id: makeId(["alvesz-ev-concl", ev.id]),
        source: "alvesz_concluido",
        sourceLabel: "Alvesz · Evento concluído",
        titulo: `Depoimento pós-evento: ${ev.titulo}`,
        descricao: `Evento realizado recentemente. Publique depoimento, antes/depois do bar e Reel de autoridade sobre ${ev.titulo}.`,
        formato: "reel",
        marca: "alvesz",
        prioridade: "alta",
        categoria: "depoimento",
      });
      opportunities.push({
        id: makeId(["alvesz-ev-autoridade", ev.id]),
        source: "alvesz_concluido",
        sourceLabel: "Alvesz · Evento concluído",
        titulo: `Conteúdo de autoridade: ${ev.titulo}`,
        descricao: `Transforme a experiência em conteúdo educativo sobre bartender premium em eventos.`,
        formato: "reel",
        marca: "alvesz",
        prioridade: "media",
        categoria: "autoridade",
      });
    }
  }

  for (const ev of eventos) {
    const tipo = ev.tipo?.toLowerCase() ?? "";
    if (!tipo.includes("alvesz") && !ev.titulo.toLowerCase().includes("alvesz")) continue;
    if (!isUpcoming(ev.data_inicio)) continue;

    opportunities.push({
      id: makeId(["cal-alvesz", ev.id]),
      source: "calendario",
      sourceLabel: "Calendário · Alvesz",
      titulo: `Evento no calendário: ${ev.titulo}`,
      descricao: `Evento Alvesz agendado. Planeje stories de preparação e Reels de bastidores.`,
      formato: "story",
      marca: "alvesz",
      prioridade: "media",
      categoria: "bastidores",
    });
  }

  return opportunities;
}

const CONSORCIOS_OBJECTIONS: Record<string, string[]> = {
  contato: [
    "Consórcio demora muito? Explique o ciclo com exemplos reais.",
    "É melhor que financiamento? Compare sem atacar bancos.",
  ],
  proposta: [
    "E se eu desistir? Fale sobre regras de contemplação e segurança.",
    "Qual a melhor carta para mim? Conteúdo de autoridade personalizado.",
  ],
  fechado: [
    "Prova social: cliente que contemplou e realizou o sonho.",
    "Depoimento sobre a jornada do consórcio até a conquista.",
  ],
};

export function buildConsorciosOpportunities(leads: Lead[]): SocialOpportunity[] {
  const opportunities: SocialOpportunity[] = [];
  const advancedStatuses = ["contato", "proposta", "fechado"];

  for (const lead of leads) {
    if (!advancedStatuses.includes(lead.status)) continue;

    const statusLabel = getLeadStatusLabel(lead.status);

    opportunities.push({
      id: makeId(["cons-lead", lead.id]),
      source: "consorcios_lead",
      sourceLabel: `Consórcios · Lead em ${statusLabel}`,
      titulo: `Ideia de conteúdo: ${lead.origem}`,
      descricao: `Lead ${lead.nome} avançou para ${statusLabel}. Crie conteúdo educativo sobre ${lead.origem} com CTA para DM.`,
      formato: "reel",
      marca: "consorcios",
      prioridade: lead.status === "proposta" ? "alta" : "media",
      categoria: "geral",
    });

    const objecoes = CONSORCIOS_OBJECTIONS[lead.status] ?? [];
    for (let i = 0; i < objecoes.length; i++) {
      opportunities.push({
        id: makeId(["cons-obj", lead.id, String(i)]),
        source: "consorcios_lead",
        sourceLabel: `Consórcios · Objeção (${statusLabel})`,
        titulo: objecoes[i]!.slice(0, 60),
        descricao: objecoes[i]!,
        formato: "reel",
        marca: "consorcios",
        prioridade: "media",
        categoria: "objecao",
      });
    }

    if (lead.status === "fechado") {
      opportunities.push({
        id: makeId(["cons-prova", lead.id]),
        source: "consorcios_lead",
        sourceLabel: "Consórcios · Prova social",
        titulo: `Prova social: conquista com consórcio`,
        descricao: `Lead fechado (${lead.origem}). Publique case de sucesso sem expor dados sensíveis.`,
        formato: "reel",
        marca: "consorcios",
        prioridade: "alta",
        categoria: "prova_social",
      });
    }
  }

  return opportunities;
}

export function buildTravelOpportunities(params: {
  trips: Trip[];
  checklist: TripChecklistItem[];
  languageProgress: LanguageProgress | null;
  languageSessions: LanguageSession[];
}): SocialOpportunity[] {
  const { trips, checklist, languageProgress, languageSessions } = params;
  const opportunities: SocialOpportunity[] = [];

  const activeTrips = trips.filter(
    (t) =>
      t.status === "planejando" ||
      t.status === "confirmada" ||
      t.status === "em_viagem"
  );

  for (const trip of activeTrips) {
    const days = daysUntilTrip(trip);
    const isDisney = trip.template_id === DISNEY_NBA_TEMPLATE_ID;
    const source = isDisney ? "disney_nba" : "viagem";
    const sourceLabel = isDisney ? "Disney + NBA" : "Viagens";

    if (days >= 0 && days <= 90) {
      opportunities.push({
        id: makeId(["trip-jornada", trip.id]),
        source,
        sourceLabel,
        titulo: `Jornada: ${trip.nome} (${days} dias)`,
        descricao: `Conte a preparação da viagem para ${trip.destino}. Reels de countdown, checklist e expectativa.`,
        formato: "reel",
        marca: "marca_pessoal",
        prioridade: days <= 30 ? "alta" : "media",
        categoria: "jornada",
      });

      opportunities.push({
        id: makeId(["trip-prep", trip.id]),
        source,
        sourceLabel,
        titulo: `Preparação: ${trip.destino}`,
        descricao: `Mostre bastidores da preparação: passagens, hotéis, ingressos Disney/NBA.`,
        formato: "story",
        marca: "marca_pessoal",
        prioridade: "media",
        categoria: "preparacao",
      });
    }

    const tripChecklist = checklist.filter((c) => c.trip_id === trip.id);
    const pending = tripChecklist.filter((c) => c.status !== "feito");
    if (pending.length > 0 && pending.length <= 5) {
      opportunities.push({
        id: makeId(["trip-checklist", trip.id]),
        source,
        sourceLabel,
        titulo: `Checklist da viagem: ${pending.length} item(ns) pendente(s)`,
        descricao: `Transforme tarefas pendentes (${pending.map((p) => p.titulo).slice(0, 3).join(", ")}) em conteúdo de preparação.`,
        formato: "story",
        marca: "marca_pessoal",
        prioridade: "baixa",
        categoria: "preparacao",
      });
    }
  }

  if (languageProgress) {
    const streak = languageProgress.streak_dias ?? 0;
    if (streak >= 3) {
      opportunities.push({
        id: makeId(["english-streak", String(streak)]),
        source: "english",
        sourceLabel: "English Coach",
        titulo: `Inglês: ${streak} dias de sequência`,
        descricao: `Compartilhe sua rotina de estudo de inglês para viagens. Mostre frases úteis para Disney/NBA.`,
        formato: "reel",
        marca: "marca_pessoal",
        prioridade: "media",
        categoria: "ingles",
      });
    }

    const recentSessions = languageSessions
      .filter((s) => isRecent(s.created_at, 7))
      .slice(0, 3);

    for (const session of recentSessions) {
      if (session.modo === "disney" || session.modo === "nba" || session.modo === "viagens") {
        opportunities.push({
          id: makeId(["english-session", session.id]),
          source: "english",
          sourceLabel: "English Coach",
          titulo: `Inglês para ${session.modo}: compartilhe o aprendizado`,
          descricao: `Sessão recente de inglês (${session.modo}). Grave um Reel ensinando 3 frases úteis para a viagem.`,
          formato: "reel",
          marca: "marca_pessoal",
          prioridade: "media",
          categoria: "ingles",
        });
      }
    }
  }

  return opportunities;
}

export function buildMetaOpportunities(goals: Goal[]): SocialOpportunity[] {
  const opportunities: SocialOpportunity[] = [];
  const active = getActiveGoals(goals);

  for (const goal of active) {
    const metrics = computeGoalMetrics(goal);
    if (metrics.pct >= 100) continue;

    if (goal.tipo === "conteudo") {
      opportunities.push({
        id: makeId(["meta-conteudo", goal.id]),
        source: "meta",
        sourceLabel: "Meta de conteúdo",
        titulo: `Meta: faltam ${metrics.remaining} publicações`,
        descricao: `${goal.titulo} — ${metrics.pct}% concluído. Planeje ${Math.min(metrics.remaining, 5)} conteúdos esta semana.`,
        formato: "reel",
        marca: "marca_pessoal",
        prioridade: isGoalBehind(goal) ? "alta" : "media",
        categoria: "geral",
      });
    }

    if (goal.tipo === "eventos") {
      opportunities.push({
        id: makeId(["meta-eventos", goal.id]),
        source: "meta",
        sourceLabel: "Meta de eventos",
        titulo: `Meta Alvesz: ${metrics.remaining} evento(s) restante(s)`,
        descricao: `Divulgue Alvesz Experience para fechar eventos. Bastidores e depoimentos ajudam a bater a meta.`,
        formato: "reel",
        marca: "alvesz",
        prioridade: isGoalBehind(goal) ? "alta" : "media",
        categoria: "autoridade",
      });
    }
  }

  return opportunities;
}

export function buildEventOpportunities(eventos: Evento[]): SocialOpportunity[] {
  const opportunities: SocialOpportunity[] = [];

  for (const ev of eventos) {
    if (!isUpcoming(ev.data_inicio, 14)) continue;
    const days = daysBetween(todayIsoDate(), ev.data_inicio.slice(0, 10));

    opportunities.push({
      id: makeId(["evento", ev.id]),
      source: "evento",
      sourceLabel: "Calendário",
      titulo: `Evento em ${days} dia(s): ${ev.titulo}`,
      descricao: ev.descricao ?? `Prepare conteúdo relacionado ao evento ${ev.titulo}.`,
      formato: "story",
      marca: "marca_pessoal",
      prioridade: days <= 3 ? "alta" : "baixa",
      categoria: "geral",
    });
  }

  return opportunities;
}

export function computeAllSocialOpportunities(params: {
  orcamentos: Orcamento[];
  alveszEventos: AlveszEvento[];
  eventos: Evento[];
  leads: Lead[];
  trips: Trip[];
  checklist: TripChecklistItem[];
  languageProgress: LanguageProgress | null;
  languageSessions: LanguageSession[];
  goals: Goal[];
  activeMarca?: InstagramMarca;
}): SocialOpportunity[] {
  const all = [
    ...buildAlveszOpportunities({
      orcamentos: params.orcamentos,
      alveszEventos: params.alveszEventos,
      eventos: params.eventos,
    }),
    ...buildConsorciosOpportunities(params.leads),
    ...buildTravelOpportunities({
      trips: params.trips,
      checklist: params.checklist,
      languageProgress: params.languageProgress,
      languageSessions: params.languageSessions,
    }),
    ...buildMetaOpportunities(params.goals),
    ...buildEventOpportunities(params.eventos),
  ];

  const priorityOrder = { alta: 0, media: 1, baixa: 2 };
  const filtered = params.activeMarca
    ? all.filter((o) => o.marca === params.activeMarca)
    : all;

  return filtered
    .sort((a, b) => priorityOrder[a.prioridade] - priorityOrder[b.prioridade])
    .slice(0, 20);
}

export function computeSocialReport(
  conteudos: Conteudo[],
  marca?: InstagramMarca | "all",
  periodo: "semana" | "mes" = "semana"
): SocialReport {
  const base =
    marca && marca !== "all" ? filterConteudosByMarca(conteudos, marca) : conteudos;
  const today = todayIsoDate();

  const rangeStart = new Date();
  if (periodo === "semana") {
    rangeStart.setDate(rangeStart.getDate() - ((rangeStart.getDay() + 6) % 7));
  } else {
    rangeStart.setDate(1);
  }
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(rangeStart);
  if (periodo === "semana") {
    rangeEnd.setDate(rangeStart.getDate() + 6);
  } else {
    rangeEnd.setMonth(rangeEnd.getMonth() + 1, 0);
  }
  rangeEnd.setHours(23, 59, 59, 999);

  let planejado = 0;
  let publicado = 0;
  let atrasado = 0;
  let emProducao = 0;

  for (const c of base) {
    const status = normalizeConteudoStatus(c.status);
    const plannedDate = c.data_publicacao?.slice(0, 10);

    if (plannedDate) {
      const d = new Date(`${plannedDate}T12:00:00`);
      if (d >= rangeStart && d <= rangeEnd) {
        planejado++;
        if (status !== "publicado" && plannedDate < today) {
          atrasado++;
        }
      }
    }

    if (status === "publicado") {
      const pubDate = getConteudoPublishedDate(c).slice(0, 10);
      const pd = new Date(`${pubDate}T12:00:00`);
      if (pd >= rangeStart && pd <= rangeEnd) {
        publicado++;
      }
    }

    if (["roteiro", "gravado", "editado"].includes(status)) {
      emProducao++;
    }
  }

  const taxaExecucao =
    planejado > 0 ? Math.round((publicado / planejado) * 100) : publicado > 0 ? 100 : 0;

  return { planejado, publicado, atrasado, taxaExecucao, emProducao };
}

export function computePostingStreak(conteudos: Conteudo[]): PostingStreakInfo {
  const today = todayIsoDate();
  const publishedDates = new Set<string>();

  for (const c of conteudos) {
    if (normalizeConteudoStatus(c.status) !== "publicado") continue;
    publishedDates.add(getConteudoPublishedDate(c).slice(0, 10));
  }

  const sorted = [...publishedDates].sort().reverse();
  const ultimaPublicacao = sorted[0] ?? null;
  const publicouHoje = publishedDates.has(today);

  let diasSemPostar = 0;
  if (!publicouHoje) {
    if (ultimaPublicacao) {
      diasSemPostar = daysBetween(ultimaPublicacao, today);
    } else {
      diasSemPostar = 999;
    }
  }

  let sequenciaAtual = 0;
  if (sorted.length > 0) {
    const startDate = publicouHoje ? today : ultimaPublicacao!;
    let cursor = startDate;
    while (publishedDates.has(cursor)) {
      sequenciaAtual++;
      const d = new Date(`${cursor}T12:00:00`);
      d.setDate(d.getDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    }
  }

  return {
    diasSemPostar: diasSemPostar === 999 ? sorted.length === 0 ? -1 : diasSemPostar : diasSemPostar,
    sequenciaAtual,
    ultimaPublicacao,
    publicouHoje,
  };
}

export function getAtrasadosConteudos(conteudos: Conteudo[]): Conteudo[] {
  const today = todayIsoDate();
  return conteudos
    .filter((c) => {
      const status = normalizeConteudoStatus(c.status);
      if (status === "publicado") return false;
      const planned = c.data_publicacao?.slice(0, 10);
      return planned ? planned < today : false;
    })
    .sort((a, b) =>
      (a.data_publicacao ?? "").localeCompare(b.data_publicacao ?? "")
    );
}

export function opportunityToSuggestion(
  opp: SocialOpportunity
): {
  titulo: string;
  plataforma: string;
  formato: string;
  objetivo: string | null;
  observacoes: string | null;
  marca: string;
} {
  return {
    titulo: opp.titulo,
    plataforma: "instagram",
    formato: normalizeConteudoFormato(opp.formato),
    objetivo: opp.descricao,
    observacoes: `[${opp.sourceLabel}] ${opp.categoria}`,
    marca: opp.marca,
  };
}

export function buildSocialIntelligenceContext(params: {
  opportunities: SocialOpportunity[];
  report: SocialReport;
  streak: PostingStreakInfo;
  atrasados: Conteudo[];
}): string {
  const { opportunities, report, streak, atrasados } = params;

  const oppLines =
    opportunities.length > 0
      ? opportunities
          .slice(0, 10)
          .map((o) => `* [${o.prioridade}] ${o.titulo} (${o.sourceLabel})`)
          .join("\n")
      : "Nenhuma oportunidade automática no momento.";

  const atrasadosLines =
    atrasados.length > 0
      ? atrasados
          .slice(0, 5)
          .map((c) => `* ${c.titulo} — planejado ${c.data_publicacao?.slice(0, 10)}`)
          .join("\n")
      : "Nenhum conteúdo atrasado.";

  const diasLabel =
    streak.diasSemPostar < 0
      ? "Sem publicações registradas"
      : streak.publicouHoje
        ? "Publicou hoje"
        : `${streak.diasSemPostar} dia(s) sem postar`;

  return `## INTELIGÊNCIA SOCIAL 2.0

### OPORTUNIDADES AUTOMÁTICAS (${opportunities.length})
${oppLines}

### RELATÓRIO (semana)
Planejado: ${report.planejado} | Publicado: ${report.publicado} | Atrasado: ${report.atrasado} | Taxa: ${report.taxaExecucao}%

### SEQUÊNCIA DE POSTAGEM
${diasLabel} | Sequência: ${streak.sequenciaAtual} dia(s) | Última: ${streak.ultimaPublicacao ?? "—"}

### CONTEÚDOS ATRASADOS
${atrasadosLines}`;
}
