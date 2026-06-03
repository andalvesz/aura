import type {
  Cliente,
  Evento,
  GrowthGoal,
  GrowthLead,
  GrowthMission,
  Orcamento,
} from "@/types/database";
import {
  formatBRL,
  formatDate,
  formatTime,
  isToday,
  isValidDate,
} from "@/utils/format";
import {
  buildExecutiveDayContext,
  computeGrowthLeadMetrics,
  getGrowthLeadStatusLabel,
  getTodayDate,
  mergeDailyMissions,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";

export type OrcamentoWithCliente = Orcamento & {
  clientes: Pick<Cliente, "nome" | "telefone" | "email"> | null;
};

export type NexusModuleData = {
  clientes: Cliente[];
  orcamentos: OrcamentoWithCliente[];
  eventos: Evento[];
  leads: GrowthLead[];
  goal: GrowthGoal | null;
  missions: GrowthMission[];
  /** Tabelas Alvesz (clientes/orçamentos) existem no Supabase */
  alveszAvailable: boolean;
  /** Tabela eventos (calendário) existe no Supabase */
  calendarAvailable: boolean;
};

export const NEXUS_ALVESZ_UNAVAILABLE_MESSAGE =
  "Nenhum dado da Alvesz disponível.";

export const NEXUS_CALENDAR_UNAVAILABLE_MESSAGE =
  "Nenhum dado de calendário disponível.";

export const NEXUS_MENTOR_ALVESZ_ACTIONS = [
  "alvesz-resumo",
  "alvesz-orcamentos",
  "alvesz-clientes",
] as const;

export const NEXUS_MENTOR_CALENDAR_ACTIONS = ["calendario-hoje", "calendario-semana"] as const;

export const NEXUS_MENTOR_DASHBOARD_ACTIONS = ["dashboard-executivo"] as const;

export type NexusMentorAlveszAction = (typeof NEXUS_MENTOR_ALVESZ_ACTIONS)[number];
export type NexusMentorCalendarAction = (typeof NEXUS_MENTOR_CALENDAR_ACTIONS)[number];
export type NexusMentorDashboardAction = (typeof NEXUS_MENTOR_DASHBOARD_ACTIONS)[number];

function normalizeMentorQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isNexusMentorAlveszAction(actionId: string): actionId is NexusMentorAlveszAction {
  return NEXUS_MENTOR_ALVESZ_ACTIONS.includes(actionId as NexusMentorAlveszAction);
}

export function isNexusMentorCalendarAction(
  actionId: string
): actionId is NexusMentorCalendarAction {
  return NEXUS_MENTOR_CALENDAR_ACTIONS.includes(actionId as NexusMentorCalendarAction);
}

export function isNexusMentorDashboardAction(
  actionId: string
): actionId is NexusMentorDashboardAction {
  return NEXUS_MENTOR_DASHBOARD_ACTIONS.includes(actionId as NexusMentorDashboardAction);
}

const ALVESZ_PHRASES = [
  "alvesz",
  "orcamento",
  "orcamentos",
  "open bar",
  "bartender",
  "clientes alvesz",
  "pipeline alvesz",
  "estoque",
] as const;

const CALENDAR_PHRASES = [
  "calendario",
  "agenda",
  "compromisso",
  "compromissos",
  "follow-up",
  "follow up",
  "reuniao",
  "reunioes",
  "proximos eventos",
  "eventos da semana",
] as const;

const DASHBOARD_PHRASES = [
  "dashboard executivo",
  "resumo executivo",
  "visao geral",
  "visao do negocio",
  "panorama",
  "central nexus",
] as const;

export function isNexusAlveszQuery(message: string, actionId?: string): boolean {
  if (actionId && isNexusMentorAlveszAction(actionId)) return true;
  const normalized = normalizeMentorQuery(message);
  return ALVESZ_PHRASES.some((phrase) => normalized.includes(normalizeMentorQuery(phrase)));
}

export function isNexusCalendarQuery(message: string, actionId?: string): boolean {
  if (actionId && isNexusMentorCalendarAction(actionId)) return true;
  const normalized = normalizeMentorQuery(message);
  return CALENDAR_PHRASES.some((phrase) => normalized.includes(normalizeMentorQuery(phrase)));
}

export function isNexusDashboardQuery(message: string, actionId?: string): boolean {
  if (actionId && isNexusMentorDashboardAction(actionId)) return true;
  const normalized = normalizeMentorQuery(message);
  return DASHBOARD_PHRASES.some((phrase) => normalized.includes(normalizeMentorQuery(phrase)));
}

function isAlveszRelatedEvento(evento: Evento): boolean {
  const text = `${evento.titulo} ${evento.descricao ?? ""}`.toLowerCase();
  return (
    evento.tipo === "trabalho" ||
    /alvesz|bartender|open bar|casamento|corporativ|formatura|cocktail|bar\b/i.test(text)
  );
}

export function filterAlveszEventos(eventos: Evento[]): Evento[] {
  return eventos.filter(isAlveszRelatedEvento);
}

export function filterUpcomingEventos(eventos: Evento[], daysAhead = 14): Evento[] {
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(limit.getDate() + daysAhead);

  return [...eventos]
    .filter((evento) => {
      if (!isValidDate(evento.data_inicio)) return false;
      const start = new Date(evento.data_inicio);
      return start >= now && start <= limit;
    })
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
}

export function filterCompromissos(eventos: Evento[]): Evento[] {
  return filterUpcomingEventos(eventos).filter(
    (evento) => evento.tipo !== "saude" || /reuniao|cliente|trabalho/i.test(evento.titulo)
  );
}

export function filterFollowUpEventos(eventos: Evento[]): Evento[] {
  return filterUpcomingEventos(eventos, 30).filter((evento) =>
    /follow[- ]?up|retomar|ligar|whatsapp|lead/i.test(
      `${evento.titulo} ${evento.descricao ?? ""}`
    )
  );
}

export function filterReunioes(eventos: Evento[]): Evento[] {
  const today = getTodayDate();
  return filterUpcomingEventos(eventos, 7).filter(
    (evento) =>
      evento.tipo === "trabalho" ||
      evento.tipo === "vendas" ||
      /reuniao|meet|cliente|apresentacao/i.test(evento.titulo)
  ).filter((evento) => evento.data_inicio.slice(0, 10) >= today);
}

function formatEventoLine(evento: Evento): string {
  const day = isToday(evento.data_inicio.slice(0, 10))
    ? "Hoje"
    : formatDate(evento.data_inicio);
  const time = formatTime(evento.data_inicio);
  const local = evento.local ? ` · ${evento.local}` : "";
  return `* ${day} ${time} — ${evento.titulo}${local} (${evento.tipo})`;
}

export function computeAlveszMetrics(orcamentos: OrcamentoWithCliente[]) {
  const pendentes = orcamentos.filter(
    (o) => o.status === "pendente" || o.status === "rascunho"
  );
  const aprovados = orcamentos.filter((o) => o.status === "aprovado");
  const pipelinePendente = pendentes.reduce((sum, o) => sum + Number(o.valor_total), 0);
  const receitaAprovada = aprovados.reduce((sum, o) => sum + Number(o.valor_total), 0);
  const lucroPendente = pendentes.reduce((sum, o) => sum + Number(o.lucro_estimado), 0);

  return {
    total: orcamentos.length,
    pendentes: pendentes.length,
    aprovados: aprovados.length,
    pipelinePendente,
    receitaAprovada,
    lucroPendente,
  };
}

export function buildNexusAlveszUnavailableContext(): string {
  return `## ALVESZ EXPERIENCE

${NEXUS_ALVESZ_UNAVAILABLE_MESSAGE}

As tabelas \`public.clientes\` e \`public.orcamentos\` (mesmas da página Alvesz) não estão disponíveis neste projeto Supabase ou ainda não foram migradas.

## INSTRUÇÕES
- Informe ao usuário que não há dados da Alvesz no momento.
- Não invente clientes, orçamentos ou valores.
- Se o usuário perguntar sobre CRM, leads ou metas, use apenas dados do módulo Crescimento quando disponíveis.`;
}

export function buildNexusCalendarUnavailableContext(): string {
  return `## CALENDÁRIO

${NEXUS_CALENDAR_UNAVAILABLE_MESSAGE}

A tabela \`public.eventos\` (mesma do módulo Calendário) não está disponível neste projeto Supabase.

## INSTRUÇÕES
- Informe que a agenda não está conectada.
- Não invente compromissos ou horários.`;
}

function buildOrcamentoEventoLines(orcamentos: OrcamentoWithCliente[]): string {
  if (orcamentos.length === 0) {
    return "* Nenhum tipo de evento nos orçamentos";
  }

  return orcamentos
    .slice(0, 12)
    .map((o) => {
      const cliente = o.clientes?.nome ?? "Sem cliente";
      return `* ${o.tipo_evento} — ${cliente} · ${o.convidados} convidados · ${o.status}`;
    })
    .join("\n");
}

export function buildNexusAlveszContext(data: NexusModuleData): string {
  if (!data.alveszAvailable && !data.clientes.length && !data.orcamentos.length) {
    return buildNexusAlveszUnavailableContext();
  }

  const { clientes, orcamentos, eventos } = data;
  const metrics = computeAlveszMetrics(orcamentos);
  const alveszEventos = data.calendarAvailable ? filterAlveszEventos(eventos) : [];

  const clienteLines =
    clientes.length > 0
      ? clientes
          .slice(0, 12)
          .map(
            (c) =>
              `* ${c.nome} (${c.tipo})${c.telefone ? ` — ${c.telefone}` : ""}${c.observacoes ? ` — ${c.observacoes.slice(0, 60)}` : ""}`
          )
          .join("\n")
      : "* Nenhum cliente cadastrado";

  const orcamentoLines =
    orcamentos.length > 0
      ? orcamentos
          .slice(0, 12)
          .map((o) => {
            const cliente = o.clientes?.nome ?? "Sem cliente";
            return `* ${cliente} — ${o.tipo_evento} · ${o.convidados} convidados · ${formatBRL(Number(o.valor_total))} · ${o.status}`;
          })
          .join("\n")
      : "* Nenhum orçamento cadastrado";

  const agendaEventoLines =
    alveszEventos.length > 0
      ? filterUpcomingEventos(alveszEventos, 30)
          .slice(0, 8)
          .map(formatEventoLine)
          .join("\n")
      : data.calendarAvailable
        ? "* Nenhum evento Alvesz na agenda"
        : "* Calendário indisponível — use os tipos de evento nos orçamentos abaixo";

  const orcamentoEventoLines = buildOrcamentoEventoLines(orcamentos);

  return `## ALVESZ EXPERIENCE (dados reais — tabelas clientes e orcamentos, como na página Alvesz)

### Clientes (${clientes.length})
${clienteLines}

### Orçamentos (${orcamentos.length})
${orcamentoLines}

### Métricas Alvesz
* Pipeline pendente: ${formatBRL(metrics.pipelinePendente)} (${metrics.pendentes} orçamentos)
* Receita aprovada: ${formatBRL(metrics.receitaAprovada)} (${metrics.aprovados} aprovados)
* Lucro estimado pendente: ${formatBRL(metrics.lucroPendente)}

### Eventos na agenda (tabela eventos / calendário)
${agendaEventoLines}

### Eventos nos orçamentos (tipo_evento)
${orcamentoEventoLines}

## INSTRUÇÕES
- Use apenas os dados acima para orçamentos, clientes e eventos Alvesz.
- Cite nomes, valores e status reais.
- Nunca peça dados manualmente quando já estiverem listados.`;
}

export function buildNexusCalendarContext(data: NexusModuleData): string {
  if (!data.calendarAvailable && data.eventos.length === 0) {
    return buildNexusCalendarUnavailableContext();
  }

  const compromissos = filterCompromissos(data.eventos);
  const followUps = filterFollowUpEventos(data.eventos);
  const reunioes = filterReunioes(data.eventos);
  const proximos = filterUpcomingEventos(data.eventos, 14);

  const section = (title: string, items: Evento[]) =>
    items.length > 0
      ? items.map(formatEventoLine).join("\n")
      : `* Nenhum ${title.toLowerCase()} agendado`;

  return `## CALENDÁRIO (dados reais — tabela eventos, como na página Calendário — ${getTodayDate()})

### Compromissos (próximos 14 dias)
${section("compromisso", compromissos)}

### Follow-ups
${section("follow-up", followUps)}

### Reuniões
${section("reunião", reunioes)}

### Todos os eventos próximos
${proximos.length > 0 ? proximos.map(formatEventoLine).join("\n") : "* Agenda vazia"}

## INSTRUÇÕES
- Organize respostas por compromissos, follow-ups e eventos quando relevante.
- Use datas e horários reais.
- Sugira priorização quando houver conflitos de agenda.`;
}

export function buildNexusExecutiveDashboardContext(data: NexusModuleData): string {
  const leadMetrics = computeGrowthLeadMetrics(data.leads);
  const alveszMetrics = computeAlveszMetrics(data.orcamentos);
  const upcomingEventos = filterUpcomingEventos(data.eventos, 30);
  const todayMissions = mergeDailyMissions(data.missions);
  const pendingMissions = todayMissions.filter((m) => m.status === "pending").length;
  const completedMissions = todayMissions.filter((m) => m.status === "completed").length;
  const topLeads = sortGrowthLeadOpportunities(data.leads).slice(0, 5);

  const leadLines =
    topLeads.length > 0
      ? topLeads
          .map(
            (l) =>
              `* ${l.nome} — ${getGrowthLeadStatusLabel(l.status)} — ${formatBRL(l.valor_potencial ?? 0)}`
          )
          .join("\n")
      : "* Nenhum lead ativo";

  const eventoLines =
    upcomingEventos.length > 0
      ? upcomingEventos
          .slice(0, 6)
          .map(formatEventoLine)
          .join("\n")
      : "* Nenhum evento próximo";

  const metaMensal = data.goal?.meta_receita_mensal ?? 0;
  const alveszSection = data.alveszAvailable
    ? `* Pipeline Alvesz pendente: ${formatBRL(alveszMetrics.pipelinePendente)}
* Orçamentos Alvesz aprovados: ${formatBRL(alveszMetrics.receitaAprovada)}`
    : `* Alvesz: ${NEXUS_ALVESZ_UNAVAILABLE_MESSAGE}`;

  const eventoSection = data.calendarAvailable
    ? eventoLines
    : `* ${NEXUS_CALENDAR_UNAVAILABLE_MESSAGE}`;

  return `## DASHBOARD EXECUTIVO NEXUS (dados reais — ${getTodayDate()})

### Receita
* Receita potencial (CRM): ${formatBRL(leadMetrics.receitaPotencial)}
* Receita fechada (CRM): ${formatBRL(leadMetrics.receita)}
${alveszSection}
* Meta mensal: ${formatBRL(metaMensal)}

### Leads prioritários
${leadLines}

### Eventos
${eventoSection}

### Missões de hoje
* Concluídas: ${completedMissions}/${todayMissions.length}
* Pendentes: ${pendingMissions}
${todayMissions.map((m) => `* ${m.titulo}: ${m.status === "completed" ? "concluída" : "pendente"}`).join("\n")}

### Resumo numérico
* Leads ativos: ${leadMetrics.ativos}
* Orçamentos Alvesz: ${data.alveszAvailable ? `${alveszMetrics.total} (${alveszMetrics.pendentes} pendentes)` : "indisponível"}
* Eventos próximos (30 dias): ${upcomingEventos.length}
* Taxa de conversão CRM: ${leadMetrics.taxaConversao.toFixed(1)}%

## INSTRUÇÕES
Responda com um resumo executivo único e objetivo. Estruture:

1. **Receita** — potencial, fechada, pipeline Alvesz e meta
2. **Leads** — top oportunidades com valores
3. **Eventos** — próximos compromissos relevantes
4. **Missões** — status do dia
5. **3 ações prioritárias** — baseadas nos dados acima

Use apenas dados reais. Nunca peça informações manualmente.`;
}

export function buildNexusDayContext(data: NexusModuleData): string {
  const base = buildExecutiveDayContext({
    leads: data.leads,
    goal: data.goal,
    missions: data.missions,
  });

  const todayMissions = mergeDailyMissions(data.missions);
  const topLeads = sortGrowthLeadOpportunities(data.leads).slice(0, 5);
  const reunioes = filterReunioes(data.eventos);
  const metaMensal = data.goal?.meta_receita_mensal ?? 0;
  const receitaAtual = data.goal?.receita_atual ?? 0;

  const tarefasLines = todayMissions
    .map((m) => `* ${m.titulo}: ${m.status === "completed" ? "concluída" : "pendente"}`)
    .join("\n");

  const leadsLines =
    topLeads.length > 0
      ? topLeads
          .map(
            (l) =>
              `* ${l.nome} — ${getGrowthLeadStatusLabel(l.status)} — ${formatBRL(l.valor_potencial ?? 0)}`
          )
          .join("\n")
      : "* Nenhum lead prioritário";

  const reunioesLines = !data.calendarAvailable
    ? `* ${NEXUS_CALENDAR_UNAVAILABLE_MESSAGE}`
    : reunioes.length > 0
      ? reunioes.map(formatEventoLine).join("\n")
      : "* Nenhuma reunião agendada para os próximos dias";

  const alveszNote = !data.alveszAvailable
    ? `\n### Alvesz\n* ${NEXUS_ALVESZ_UNAVAILABLE_MESSAGE}\n`
    : "";

  return `${base}${alveszNote}

## MEU DIA — MÓDULOS NEXUS (${getTodayDate()})

### Tarefas (missões do dia)
${tarefasLines}

### Leads prioritários
${leadsLines}

### Reuniões
${reunioesLines}

### Metas
* Meta mensal: ${formatBRL(metaMensal)}
* Receita registrada na meta: ${formatBRL(receitaAtual)}
* Faltam: ${formatBRL(Math.max(0, metaMensal - receitaAtual))}

## INSTRUÇÕES ADICIONAIS — MEU DIA
Além do resumo executivo padrão, inclua seções claras para:
1. **Tarefas** — missões pendentes e concluídas
2. **Leads prioritários** — com nome, status e valor
3. **Reuniões** — agenda real do calendário
4. **Metas** — meta mensal e progresso

Mantenha tom de Diretor Executivo. Use dados reais apenas.`;
}
