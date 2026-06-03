import type { AuraGlobalSummaryData } from "@/utils/mentor";
import {
  isAuraMentorGlobalSummaryQuery,
  isAuraMentorGlobalSummaryAction,
} from "@/utils/mentor";
import {
  isGrowthMentorCrmQuery,
  isGrowthMentorExecutiveQuery,
  isGrowthMentorMemoryQuery,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";
import { getExecutiveGreeting } from "@/utils/executive";
import { formatTime } from "@/utils/format";
import {
  isNexusAlveszQuery,
  isNexusCalendarQuery,
} from "@/utils/nexus";
import { normalizeConteudoStatus } from "@/utils/social";
import { todayIsoDate, workoutForToday } from "@/utils/health";

export type AuraCentralModule =
  | "global"
  | "calendario"
  | "crescimento"
  | "alvesz"
  | "saude"
  | "social-media"
  | "financeiro";

export type AuraCentralMode =
  | "chat"
  | "treino"
  | "dieta"
  | "criar-evento"
  | "ideias";

export type AuraCentralIntent = {
  module: AuraCentralModule;
  mode: AuraCentralMode;
  actionId?: string;
};

export const AURA_CENTRAL_QUICK_ACTIONS = [
  {
    id: "o-que-fazer",
    label: "O que fazer hoje?",
    module: "global" as const,
    prompt: "O que devo fazer hoje?",
  },
  {
    id: "treino-hoje",
    label: "Treino de hoje",
    module: "saude" as const,
    prompt: "Crie meu treino de hoje",
  },
  {
    id: "marcar-reuniao",
    label: "Marcar reunião",
    module: "calendario" as const,
    prompt: "Marque reunião com João amanhã às 15h",
  },
  {
    id: "analisar-vendas",
    label: "Analisar vendas",
    module: "crescimento" as const,
    prompt: "Analise minhas vendas",
  },
  {
    id: "conteudo-instagram",
    label: "Conteúdo Instagram",
    module: "social-media" as const,
    prompt: "Crie conteúdo para Instagram",
  },
  {
    id: "meta-mensal",
    label: "Como está minha meta?",
    module: "crescimento" as const,
    prompt: "Como está minha meta?",
  },
] as const;

export const AURA_CENTRAL_CONTEXT = `Você é a Aura Central — única interface de IA que coordena toda a Aura OS para Anderson Alves.

## CONTEXTO PERMANENTE
- Usuário: Anderson Alves · Indaiatuba, SP
- Negócios: Alvesz Experience (bartender premium, eventos) · Consórcios Ademicon
- Marca pessoal: @and.alvesz — dança, ginástica, teatro, Disney/NBA, recuperação do ombro
- Módulos que você coordena: Calendário, Crescimento, Alvesz, Saúde, Social Media, Financeiro

## PAPEL
- Decida qual módulo usar e responda com dados reais do Supabase
- Integre informações entre módulos quando fizer sentido
- Tom executivo, prático e orientado a ação — português do Brasil
- Nunca invente dados; se faltar informação, diga e sugira o próximo passo
- Os assistentes especializados (Aura Mentor, Aura Agenda, Aura Saúde) continuam existindo — você os coordena`;

export const AURA_CENTRAL_MODULE_LABELS: Record<AuraCentralModule, string> = {
  global: "Aura Central",
  calendario: "Calendário",
  crescimento: "Crescimento",
  alvesz: "Alvesz",
  saude: "Saúde",
  "social-media": "Social Media",
  financeiro: "Financeiro",
};

function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => normalized.includes(normalizeQuery(phrase)));
}

const CALENDAR_CREATE_PHRASES = [
  "marque ",
  "marca ",
  "agende ",
  "agendar ",
  "criar evento",
  "criar compromisso",
  "criar reuniao",
  "marcar reuniao",
  "marcar evento",
  "novo evento",
  "bota na agenda",
  "coloca na agenda",
  "colocar na agenda",
] as const;

const HEALTH_TREINO_PHRASES = [
  "treino de hoje",
  "criar treino",
  "crie treino",
  "crie meu treino",
  "monte treino",
  "monte meu treino",
  "gerar treino",
  "meu treino",
] as const;

const HEALTH_GENERAL_PHRASES = [
  "saude",
  "dieta",
  "habito",
  "habitos",
  "ginastica",
  "danca",
  "teatro",
  "ombro",
  "recuperacao",
  "meditacao",
  "leitura",
  "rotina de atleta",
] as const;

const SOCIAL_PHRASES = [
  "instagram",
  "conteudo",
  "conteudos",
  "reels",
  "reel",
  "roteiro",
  "story",
  "stories",
  "tiktok",
  "social media",
  "redes sociais",
  "post para",
  "criar post",
] as const;

const FINANCE_PHRASES = [
  "financeiro",
  "gastos",
  "gasto ",
  "despesas",
  "saldo",
  "orcamento pessoal",
  "quanto gastei",
  "controle financeiro",
] as const;

const META_PHRASES = [
  "minha meta",
  "meta mensal",
  "como esta minha meta",
  "progresso da meta",
  "faltam para a meta",
] as const;

const SALES_PHRASES = [
  "vendas",
  "analise minhas vendas",
  "analisar vendas",
  "funil",
  "pipeline",
  "crm",
  "leads",
  "oportunidades",
  "fechamento",
  "receita",
] as const;

export function isAuraCentralCalendarCreateQuery(message: string): boolean {
  const normalized = normalizeQuery(message);
  if (!normalized) return false;

  if (
    matchesAny(normalized, [
      "minha agenda",
      "o que tenho na agenda",
      "agenda de hoje",
      "agenda hoje",
    ])
  ) {
    return false;
  }

  return matchesAny(normalized, CALENDAR_CREATE_PHRASES);
}

export function isAuraCentralHealthTreinoQuery(message: string): boolean {
  const normalized = normalizeQuery(message);
  return matchesAny(normalized, HEALTH_TREINO_PHRASES);
}

export function isAuraCentralHealthQuery(message: string): boolean {
  const normalized = normalizeQuery(message);
  return (
    isAuraCentralHealthTreinoQuery(message) ||
    matchesAny(normalized, HEALTH_GENERAL_PHRASES)
  );
}

export function isAuraCentralSocialQuery(message: string): boolean {
  const normalized = normalizeQuery(message);
  return matchesAny(normalized, SOCIAL_PHRASES);
}

export function isAuraCentralFinanceQuery(message: string): boolean {
  const normalized = normalizeQuery(message);
  return matchesAny(normalized, FINANCE_PHRASES);
}

export function isAuraCentralMetaQuery(message: string): boolean {
  const normalized = normalizeQuery(message);
  return matchesAny(normalized, META_PHRASES);
}

export function isAuraCentralSalesQuery(message: string, actionId?: string): boolean {
  if (isGrowthMentorCrmQuery(message, actionId)) return true;
  const normalized = normalizeQuery(message);
  return matchesAny(normalized, SALES_PHRASES);
}

export function detectAuraCentralIntent(
  message: string,
  actionId?: string
): AuraCentralIntent {
  if (actionId === "treino-hoje" || isAuraCentralHealthTreinoQuery(message)) {
    return { module: "saude", mode: "treino", actionId };
  }

  if (actionId === "marcar-reuniao" || isAuraCentralCalendarCreateQuery(message)) {
    return { module: "calendario", mode: "criar-evento", actionId };
  }

  if (
    actionId === "o-que-fazer" ||
    isAuraMentorGlobalSummaryQuery(message, actionId) ||
    isGrowthMentorExecutiveQuery(message, actionId)
  ) {
    return { module: "global", mode: "chat", actionId };
  }

  if (actionId === "conteudo-instagram" || isAuraCentralSocialQuery(message)) {
    return {
      module: "social-media",
      mode: message.toLowerCase().includes("roteiro") ? "ideias" : "chat",
      actionId,
    };
  }

  if (isAuraCentralFinanceQuery(message)) {
    return { module: "financeiro", mode: "chat", actionId };
  }

  if (
    actionId === "meta-mensal" ||
    actionId === "analisar-vendas" ||
    isAuraCentralMetaQuery(message) ||
    isAuraCentralSalesQuery(message, actionId)
  ) {
    return { module: "crescimento", mode: "chat", actionId };
  }

  if (isGrowthMentorMemoryQuery(message, actionId)) {
    return { module: "crescimento", mode: "chat", actionId };
  }

  if (isAuraCentralHealthQuery(message)) {
    const mode = normalizeQuery(message).includes("dieta") ? "dieta" : "chat";
    return { module: "saude", mode, actionId };
  }

  if (isNexusAlveszQuery(message, actionId)) {
    return { module: "alvesz", mode: "chat", actionId };
  }

  if (isNexusCalendarQuery(message, actionId)) {
    return { module: "calendario", mode: "chat", actionId };
  }

  if (actionId && isAuraMentorGlobalSummaryAction(actionId)) {
    return { module: "global", mode: "chat", actionId };
  }

  return { module: "global", mode: "chat", actionId };
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${pluralForm}`;
}

export type AuraCentralOpeningSummary = {
  greeting: string;
  bullets: string[];
  text: string;
};

export function buildAuraCentralOpeningSummary(
  data: AuraGlobalSummaryData
): AuraCentralOpeningSummary {
  const today = todayIsoDate();
  const priorityLeads = sortGrowthLeadOpportunities(
    data.leads.filter((l) => l.status !== "fechado" && l.status !== "perdido")
  );
  const todayEvents = data.eventos.filter(
    (e) => e.data_inicio.slice(0, 10) === today
  );
  const pendingContent = data.conteudos.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  );
  const treinoHoje = workoutForToday(data.healthWorkouts);

  const bullets: string[] = [];

  if (priorityLeads.length > 0) {
    bullets.push(
      plural(priorityLeads.length, "lead prioritário", "leads prioritários")
    );
  }
  if (treinoHoje) {
    bullets.push(`1 treino (${treinoHoje.nome})`);
  } else if (data.healthWorkouts.length === 0) {
    bullets.push("nenhum treino cadastrado");
  }
  if (pendingContent.length > 0) {
    bullets.push(
      plural(pendingContent.length, "conteúdo pendente", "conteúdos pendentes")
    );
  }
  if (todayEvents.length > 0) {
    bullets.push(plural(todayEvents.length, "reunião/evento", "reuniões/eventos"));
  }

  if (bullets.length === 0) {
    bullets.push("agenda livre — hora de prospectar e criar conteúdo");
  }

  const greeting = getExecutiveGreeting("Anderson").replace(",", ",");
  const bulletLines = bullets.map((b) => `- ${b}`).join("\n");
  const text = `${greeting}\n\nHoje:\n${bulletLines}`;

  if (todayEvents.length > 0) {
    const upcomingToday = todayEvents
      .filter((e) => new Date(e.data_inicio) >= new Date())
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
    const nextEvent = upcomingToday[0] ?? todayEvents[0];
    return {
      greeting,
      bullets,
      text: `${text}\n\nPróximo: ${formatTime(nextEvent.data_inicio)} — ${nextEvent.titulo}`,
    };
  }

  return { greeting, bullets, text };
}
