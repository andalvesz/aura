import type { AuraCeoSession, CreatorResearch } from "@/types/database";
import {
  rankProductsBySalePotential,
  rankProductsForLaunch,
  type CreatorProductBundle,
} from "@/utils/creator";
import type { IntegrationCenterDashboard } from "@/lib/supabase/services/integration-center.service";
import { formatBRL } from "@/utils/format";
import {
  formatIntegrationCents,
  formatIntegrationDateTime,
  integrationPlatformLabel,
  integrationStatusLabel,
} from "@/utils/integrations";

export type CeoOpportunityItem = {
  titulo: string;
  descricao: string;
  score: number;
  modulo?: string;
  pais_recomendado?: string;
  idioma_recomendado?: string;
  moeda_recomendada?: string;
  motivo_estrategico?: string;
};

export type CeoOpportunityRadar = {
  melhorOportunidade: CeoOpportunityItem;
  maisLucrativo: CeoOpportunityItem;
  maisRapido: CeoOpportunityItem;
  maisAlinhadoLegado: CeoOpportunityItem;
  maisEscalavel: CeoOpportunityItem;
  scoreIa: number;
};

export type GeneratedCeoPlan = {
  resumo_executivo: string;
  prioridades: string[];
  riscos: string[];
  oportunidades: string[];
  plano_acao: string;
  cronograma: { semana: number; foco: string; tarefas: string[] }[];
  missoes_recomendadas: { titulo: string; descricao: string; modulo?: string }[];
  probabilidade_sucesso: number;
  opportunity_radar: {
    melhor_oportunidade: CeoOpportunityItem;
    mais_lucrativo: CeoOpportunityItem;
    mais_rapido: CeoOpportunityItem;
    mais_alinhado_legado: CeoOpportunityItem;
    mais_escalavel: CeoOpportunityItem;
    score_ia: number;
  };
};

export type CeoDashboardMetrics = {
  metaFinanceiraAtiva: string;
  projetoPrincipal: string;
  missaoDoDia: string;
  xpAtual: number;
  xpNivel: number;
  valorConquistado: number;
  proximoMarco: string;
};

export const CEO_AI_CONTEXT = `Você é a Aura CEO — inteligência central da Aura.
Analise Legado, Money Missions, Creator, Research, CopyLab, Launch, Financeiro, Metas, Social Media, Alvesz, Idiomas, Viagens, Saúde e Calendário.
Gere estratégias executivas com resumo, prioridades, riscos, oportunidades, plano de ação, cronograma e missões recomendadas.
Ao sugerir produtos internacionais, indique país recomendado, idioma, moeda e motivo estratégico.
Tom de conselheiro executivo, orientado a ação.`;

export const CEO_EXAMPLE_QUESTIONS = [
  "Como ganho R$ 20.000?",
  "Quanto lucrei esse mês?",
  "Qual minha melhor campanha?",
  "Qual anúncio está ruim?",
  "Quanto estou gastando?",
  "Qual campanha devo escalar?",
  "Qual conta está conectada?",
  "Qual Pixel está ativo?",
  "Quanto posso investir?",
  "Qual produto lançar nos EUA?",
  "Qual meu melhor projeto hoje?",
  "O que devo priorizar?",
] as const;

const CEO_FOCUS_PHRASES = [
  "qual meu foco hoje",
  "meu foco hoje",
  "foco de hoje",
  "qual o foco",
] as const;

const CEO_DELAY_PHRASES = [
  "o que esta me atrasando",
  "o que me atrasa",
  "esta me atrasando",
  "por que estou atrasado",
] as const;

const CEO_OPPORTUNITY_PHRASES = [
  "qual oportunidade devo aproveitar",
  "oportunidade devo aproveitar",
  "qual oportunidade aproveitar",
] as const;

const CEO_PLAN_30_PHRASES = [
  "plano para os proximos 30 dias",
  "plano 30 dias",
  "proximos 30 dias",
  "crie um plano para os proximos 30",
] as const;

const CEO_SYNC_ALL_PHRASES = [
  "sincronize tudo",
  "sincronizar tudo",
  "sync tudo",
  "atualize minhas integracoes",
] as const;

const CEO_INTEGRATIONS_STATUS_PHRASES = [
  "como estao minhas integracoes",
  "status das integracoes",
  "minhas integracoes",
  "integracoes conectadas",
] as const;

const CEO_INTEGRATIONS_TODAY_PHRASES = [
  "o que aconteceu hoje",
  "o que aconteceu nas integracoes",
  "eventos de hoje",
  "logs de hoje",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export type CeoCoachMode =
  | "ceo-focus"
  | "ceo-delay"
  | "ceo-opportunity"
  | "ceo-plan-30"
  | "ceo-sync-all"
  | "ceo-integrations-status"
  | "ceo-integrations-today";

export function detectCeoCoachMode(message: string): CeoCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, CEO_SYNC_ALL_PHRASES)) return "ceo-sync-all";
  if (matchesAny(normalized, CEO_INTEGRATIONS_STATUS_PHRASES)) return "ceo-integrations-status";
  if (matchesAny(normalized, CEO_INTEGRATIONS_TODAY_PHRASES)) return "ceo-integrations-today";
  if (matchesAny(normalized, CEO_PLAN_30_PHRASES)) return "ceo-plan-30";
  if (matchesAny(normalized, CEO_OPPORTUNITY_PHRASES)) return "ceo-opportunity";
  if (matchesAny(normalized, CEO_DELAY_PHRASES)) return "ceo-delay";
  if (matchesAny(normalized, CEO_FOCUS_PHRASES)) return "ceo-focus";
  return null;
}

export function isCeoIntegrationMode(mode: CeoCoachMode): boolean {
  return (
    mode === "ceo-sync-all" ||
    mode === "ceo-integrations-status" ||
    mode === "ceo-integrations-today"
  );
}

export function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

export function parseCronograma(value: unknown): GeneratedCeoPlan["cronograma"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is GeneratedCeoPlan["cronograma"][number] => {
      return (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { semana?: unknown }).semana === "number" &&
        typeof (item as { foco?: unknown }).foco === "string" &&
        Array.isArray((item as { tarefas?: unknown }).tarefas)
      );
    })
    .map((item) => ({
      semana: item.semana,
      foco: item.foco,
      tarefas: item.tarefas.filter((t): t is string => typeof t === "string"),
    }));
}

export function parseMissoesRecomendadas(
  value: unknown
): GeneratedCeoPlan["missoes_recomendadas"] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is GeneratedCeoPlan["missoes_recomendadas"][number] =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { titulo?: unknown }).titulo === "string"
  );
}

function emptyOpportunity(label: string): CeoOpportunityItem {
  return { titulo: label, descricao: "Cadastre dados nos módulos da Aura.", score: 0 };
}

function toOpportunityItem(
  titulo: string,
  descricao: string,
  score: number,
  modulo?: string
): CeoOpportunityItem {
  return {
    titulo,
    descricao,
    score: Math.min(100, Math.max(0, Math.round(score))),
    modulo,
  };
}

export function computeOpportunityRadarFromData(params: {
  bundles: CreatorProductBundle[];
  research: CreatorResearch[];
  legacySummary?: string;
}): CeoOpportunityRadar {
  const { bundles, research, legacySummary } = params;
  const forLaunch = rankProductsForLaunch(bundles);
  const forSales = rankProductsBySalePotential(bundles);

  const bestLaunch = forLaunch[0];
  const bestSeller = forSales[0];

  const bestResearchLegacy = [...research].sort(
    (a, b) => (b.compatibilidade_perfil ?? 0) - (a.compatibilidade_perfil ?? 0)
  )[0];
  const bestResearchScale = [...research].sort(
    (a, b) => (b.escalabilidade ?? 0) - (a.escalabilidade ?? 0)
  )[0];

  const maisLucrativo = bestSeller
    ? toOpportunityItem(
        bestSeller.product.nome ?? bestSeller.product.nicho ?? "Produto",
        `Lucro potencial · estágio ${bestSeller.product.status}`,
        bestSeller.validation?.lucro_potencial ??
          bestSeller.validation?.nota_final ??
          bestSeller.product.probabilidade_venda ??
          50,
        "creator"
      )
    : emptyOpportunity("Produto digital");

  const maisRapido = bestLaunch
    ? toOpportunityItem(
        bestLaunch.product.nome ?? bestLaunch.product.nicho ?? "Produto",
        `Pronto para lançamento · ${bestLaunch.product.status}`,
        bestLaunch.validation?.nota_final ?? 60,
        "launch"
      )
    : emptyOpportunity("Lançamento rápido");

  const maisAlinhadoLegado = bestResearchLegacy
    ? toOpportunityItem(
        bestResearchLegacy.nicho ?? bestResearchLegacy.ideia_input ?? "Ideia validada",
        bestResearchLegacy.diferencial_sugerido ?? "Alta compatibilidade com seu perfil",
        bestResearchLegacy.compatibilidade_perfil ?? 50,
        "research"
      )
    : legacySummary
      ? toOpportunityItem("Expertise do Legado", legacySummary.slice(0, 120), 55, "legado")
      : emptyOpportunity("Alinhado ao Legado");

  const maisEscalavel = bestResearchScale
    ? toOpportunityItem(
        bestResearchScale.nicho ?? bestResearchScale.ideia_input ?? "Nicho escalável",
        `Escalabilidade ${bestResearchScale.escalabilidade ?? "—"}/100`,
        bestResearchScale.escalabilidade ?? 50,
        "research"
      )
    : emptyOpportunity("Projeto escalável");

  const scores = [
    maisLucrativo.score,
    maisRapido.score,
    maisAlinhadoLegado.score,
    maisEscalavel.score,
  ];
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  const melhorOportunidade = [maisLucrativo, maisRapido, maisAlinhadoLegado, maisEscalavel].sort(
    (a, b) => b.score - a.score
  )[0]!;

  return {
    melhorOportunidade,
    maisLucrativo,
    maisRapido,
    maisAlinhadoLegado,
    maisEscalavel,
    scoreIa: Math.round(avgScore),
  };
}

export function parseOpportunityRadar(value: unknown): CeoOpportunityRadar | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const parseItem = (key: string, fallback: CeoOpportunityItem): CeoOpportunityItem => {
    const item = raw[key];
    if (!item || typeof item !== "object") return fallback;
    const o = item as Record<string, unknown>;
    return {
      titulo: typeof o.titulo === "string" ? o.titulo : fallback.titulo,
      descricao: typeof o.descricao === "string" ? o.descricao : fallback.descricao,
      score: typeof o.score === "number" ? o.score : fallback.score,
      modulo: typeof o.modulo === "string" ? o.modulo : fallback.modulo,
    };
  };

  const empty = emptyOpportunity("—");
  const radar: CeoOpportunityRadar = {
    melhorOportunidade: parseItem("melhorOportunidade", empty),
    maisLucrativo: parseItem("maisLucrativo", empty),
    maisRapido: parseItem("maisRapido", empty),
    maisAlinhadoLegado: parseItem("maisAlinhadoLegado", empty),
    maisEscalavel: parseItem("maisEscalavel", empty),
    scoreIa: typeof raw.scoreIa === "number" ? raw.scoreIa : 0,
  };

  if (radar.melhorOportunidade.titulo === "—" && typeof raw.melhor_oportunidade === "object") {
    radar.melhorOportunidade = parseItem("melhor_oportunidade", empty);
    radar.maisLucrativo = parseItem("mais_lucrativo", radar.maisLucrativo);
    radar.maisRapido = parseItem("mais_rapido", radar.maisRapido);
    radar.maisAlinhadoLegado = parseItem("mais_alinhado_legado", radar.maisAlinhadoLegado);
    radar.maisEscalavel = parseItem("mais_escalavel", radar.maisEscalavel);
    if (typeof raw.score_ia === "number") radar.scoreIa = raw.score_ia;
  }

  return radar;
}

export function normalizeGeneratedRadar(
  generated: GeneratedCeoPlan["opportunity_radar"]
): CeoOpportunityRadar {
  return {
    melhorOportunidade: generated.melhor_oportunidade,
    maisLucrativo: generated.mais_lucrativo,
    maisRapido: generated.mais_rapido,
    maisAlinhadoLegado: generated.mais_alinhado_legado,
    maisEscalavel: generated.mais_escalavel,
    scoreIa: generated.score_ia,
  };
}

export function buildCeoAuraContext(
  session: AuraCeoSession | null,
  dashboard: CeoDashboardMetrics,
  radar: CeoOpportunityRadar
): string {
  const lines = [
    "### Dashboard CEO",
    `Meta financeira: ${dashboard.metaFinanceiraAtiva}`,
    `Projeto principal: ${dashboard.projetoPrincipal}`,
    `Missão do dia: ${dashboard.missaoDoDia}`,
    `XP: ${dashboard.xpAtual} (nível ${dashboard.xpNivel})`,
    `Valor conquistado: ${formatBRL(dashboard.valorConquistado)}`,
    `Próximo marco: ${dashboard.proximoMarco}`,
    "",
    "### Opportunity Radar",
    `Score IA: ${radar.scoreIa}/100`,
    `Melhor oportunidade: ${radar.melhorOportunidade.titulo} (${radar.melhorOportunidade.score})`,
    `Mais lucrativo: ${radar.maisLucrativo.titulo}`,
    `Mais rápido: ${radar.maisRapido.titulo}`,
    `Mais alinhado ao legado: ${radar.maisAlinhadoLegado.titulo}`,
    `Mais escalável: ${radar.maisEscalavel.titulo}`,
  ];

  if (session) {
    lines.push(
      "",
      `### Sessão ativa: ${session.pergunta}`,
      session.resumo_executivo ? `Resumo: ${session.resumo_executivo}` : "",
      session.plano_acao ? `Plano: ${session.plano_acao.slice(0, 300)}` : ""
    );
  }

  return lines.filter(Boolean).join("\n");
}

export function buildCeoCoachReply(params: {
  mode: CeoCoachMode;
  displayName: string;
  session: AuraCeoSession | null;
  dashboard: CeoDashboardMetrics;
  radar: CeoOpportunityRadar;
}): string {
  const { mode, displayName, session, dashboard, radar } = params;
  const firstName = displayName.split(" ")[0] ?? displayName;

  switch (mode) {
    case "ceo-focus":
      return `${firstName}, seu foco de hoje:

**1.** ${dashboard.missaoDoDia}
**2.** Projeto principal: **${dashboard.projetoPrincipal}**
**3.** Próximo marco: ${dashboard.proximoMarco}

Melhor oportunidade agora: **${radar.melhorOportunidade.titulo}** (score ${radar.melhorOportunidade.score}/100)

${session?.prioridades ? `Prioridades da sessão CEO:\n${parseJsonStringArray(session.prioridades).slice(0, 3).map((p, i) => `${i + 1}. ${p}`).join("\n")}` : "Acesse /dashboard/ceo para gerar um plano estratégico completo."}`;

    case "ceo-delay":
      return `${firstName}, o que pode estar te atrasando:

${session ? parseJsonStringArray(session.riscos).slice(0, 4).map((r) => `• ${r}`).join("\n") || "• Revise missões pendentes no Money Missions e Creator" : "• Missões pendentes nos módulos\n• Falta de plano estratégico unificado"}

**Ação imediata:** ${dashboard.missaoDoDia}
**Meta ativa:** ${dashboard.metaFinanceiraAtiva}`;

    case "ceo-opportunity":
      return `${firstName}, oportunidade recomendada:

**${radar.melhorOportunidade.titulo}** — ${radar.melhorOportunidade.descricao}
Score: ${radar.melhorOportunidade.score}/100 · Radar geral: ${radar.scoreIa}/100

Alternativas:
• Mais lucrativo: ${radar.maisLucrativo.titulo}
• Mais rápido: ${radar.maisRapido.titulo}
• Mais escalável: ${radar.maisEscalavel.titulo}`;

    case "ceo-plan-30":
      if (session?.cronograma) {
        const cronograma = parseCronograma(session.cronograma);
        return `${firstName}, plano de 30 dias (sessão CEO):

${session.resumo_executivo ?? ""}

${cronograma.map((s) => `**Semana ${s.semana}:** ${s.foco}\n${s.tarefas.map((t) => `• ${t}`).join("\n")}`).join("\n\n")}

Probabilidade de sucesso: ${session.probabilidade_sucesso ?? "—"}%`;
      }
      return `${firstName}, acesse **Aura CEO** (/dashboard/ceo) e peça: "Crie um plano para os próximos 30 dias."

Com base nos seus dados:
• Foco: ${radar.melhorOportunidade.titulo}
• Meta: ${dashboard.metaFinanceiraAtiva}
• Projeto: ${dashboard.projetoPrincipal}`;

    default:
      return `${firstName}, acesse /dashboard/ceo para inteligência central.`;
  }
}

export function buildCeoIntegrationReply(params: {
  mode: Extract<
    CeoCoachMode,
    "ceo-sync-all" | "ceo-integrations-status" | "ceo-integrations-today"
  >;
  displayName: string;
  center: IntegrationCenterDashboard | null;
  syncMessage?: string | null;
}): string {
  const { mode, displayName, center, syncMessage } = params;
  const firstName = displayName.split(" ")[0] ?? displayName;

  if (!center) {
    return `${firstName}, não consegui carregar o Integration Center. Acesse /dashboard/integrations.`;
  }

  const connected = center.connections.filter((c) => c.status === "connected" && !c.comingSoon);

  if (mode === "ceo-sync-all") {
    return `${firstName}, sincronização executada.

${syncMessage ?? center.sync.lastLog?.message ?? "Integrações atualizadas."}

**Conectadas:** ${connected.map((c) => c.label).join(", ") || "Nenhuma"}
**Última sync:** ${formatIntegrationDateTime(center.sync.lastSyncAt)}
**Receita importada:** ${formatIntegrationCents(center.metrics.importedRevenueCents)}

Detalhes em /dashboard/integrations`;
  }

  if (mode === "ceo-integrations-status") {
    const lines = center.connections
      .filter((c) => !c.comingSoon)
      .map(
        (c) =>
          `• **${c.label}:** ${integrationStatusLabel(c.status)}${
            c.lastError ? ` (${c.lastError})` : ""
          }`
      );

    return `${firstName}, status das integrações:

${lines.join("\n")}

**Dashboard**
• Receita: ${formatIntegrationCents(center.metrics.importedRevenueCents)}
• Comissões: ${formatIntegrationCents(center.metrics.commissionsCents)}
• Campanhas ativas: ${center.metrics.activeCampaigns}
• Produtos ativos: ${center.metrics.activeProducts}

Última sync: ${formatIntegrationDateTime(center.sync.lastSyncAt)}
Próxima: ${formatIntegrationDateTime(center.sync.nextSyncAt)}`;
  }

  const todayEvents = center.events.filter((event) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(event.created_at) >= today;
  });

  if (todayEvents.length === 0) {
    return `${firstName}, nenhum evento de integração registrado hoje.

Conecte plataformas em /dashboard/integrations ou diga **"Sincronize tudo"**.`;
  }

  const eventLines = todayEvents.slice(0, 8).map(
    (event) =>
      `• ${formatIntegrationDateTime(event.created_at)} — **${integrationPlatformLabel(event.platform)}** ${event.title}: ${event.message || event.event_type}`
  );

  return `${firstName}, o que aconteceu hoje nas integrações:

${eventLines.join("\n")}

${center.sync.errors.length > 0 ? `\n**Erros:**\n${center.sync.errors.map((e) => `• ${e}`).join("\n")}` : ""}`;
}
