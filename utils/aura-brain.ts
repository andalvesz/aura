import type { PerformanceExecutiveMemory } from "@/utils/performance";

export type AuraBrainAgentMode = "full" | "memory" | "agents";

export const AURA_BRAIN_AI_CONTEXT = `Você é a Aura Brain — inteligência central da Aura OS.
Você tem acesso ao contexto completo do usuário: legado, negócios, financeiro, global, execução e memória.
Use dados reais do contexto. Não invente métricas. Priorize ações de maior impacto.
Responda em português do Brasil, de forma estratégica e acionável.`;

export type AuraBrainSections = {
  legado: string;
  negocios: string;
  financeiro: string;
  global: string;
  execucao: string;
  memoria: string;
};

export const DEFAULT_BRAIN_DAILY_TASKS = [
  "Criar produto",
  "Publicar conteúdo",
  "Revisar campanha",
  "Prospectar clientes",
] as const;

export type AuraBrainOpeningBriefing = {
  greeting: string;
  metaPrincipal: string;
  tarefasHoje: string[];
  melhorOportunidade: string;
  riscoAtual: string;
  sugestao: string;
  text: string;
  bullets: string[];
};

export function buildAuraBrainOpeningBriefing(params: {
  displayName: string;
  metaPrincipal: string;
  tarefasHoje: string[];
  melhorOportunidade: string;
  riscoAtual: string;
  sugestao: string;
}): AuraBrainOpeningBriefing {
  const firstName = params.displayName.split(" ")[0] ?? params.displayName;
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? `Bom dia, ${firstName}.`
      : hour < 18
        ? `Boa tarde, ${firstName}.`
        : `Boa noite, ${firstName}.`;

  const taskLines = params.tarefasHoje
    .slice(0, 6)
    .map((t) => `☐ ${t}`)
    .join("\n");

  const text = [
    greeting,
    "",
    "Meta principal:",
    params.metaPrincipal,
    "",
    "Hoje você deve:",
    "",
    taskLines,
    "",
    "Melhor oportunidade:",
    params.melhorOportunidade,
    "",
    "Risco atual:",
    params.riscoAtual,
    "",
    "Sugestão:",
    params.sugestao,
  ].join("\n");

  const bullets = [
    `Meta principal: ${params.metaPrincipal}`,
    `Melhor oportunidade: ${params.melhorOportunidade}`,
    `Risco atual: ${params.riscoAtual}`,
    `Sugestão: ${params.sugestao}`,
  ];

  return {
    greeting,
    metaPrincipal: params.metaPrincipal,
    tarefasHoje: params.tarefasHoje,
    melhorOportunidade: params.melhorOportunidade,
    riscoAtual: params.riscoAtual,
    sugestao: params.sugestao,
    text,
    bullets,
  };
}

export function isAuraBrainFullContextQuery(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  return (
    normalized.includes("pense usando todo meu contexto") ||
    normalized.includes("use todo meu contexto") ||
    normalized.includes("aura brain") ||
    normalized.includes("usar aura brain")
  );
}

export function isAuraBrainLearnedContextQuery(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  return (
    normalized.includes("use tudo que ja aprendemos") ||
    normalized.includes("tudo que ja aprendemos") ||
    normalized.includes("o que ja aprendemos") ||
    normalized.includes("memoria da aura") ||
    normalized.includes("use nossa memoria")
  );
}

export function buildAuraBrainMarkdown(sections: AuraBrainSections): string {
  const blocks = [
    "## AURA BRAIN — Inteligência Central",
    sections.legado ? `### LEGADO\n${sections.legado}` : "",
    sections.negocios ? `### NEGÓCIOS\n${sections.negocios}` : "",
    sections.financeiro ? `### FINANCEIRO\n${sections.financeiro}` : "",
    sections.global ? `### GLOBAL\n${sections.global}` : "",
    sections.execucao ? `### EXECUÇÃO\n${sections.execucao}` : "",
    sections.memoria ? `### MEMÓRIA\n${sections.memoria}` : "",
  ].filter(Boolean);

  return blocks.join("\n\n");
}

export function buildAuraBrainMemoryMarkdown(params: {
  estrategiasVencedoras: string;
  campanhasVencedoras: string;
  errosRecorrentes: string;
  aprendizadoMes: string;
  memoriaPersistente: string;
  executiveMemory?: PerformanceExecutiveMemory | null;
}): string {
  const execLines: string[] = [];
  if (params.executiveMemory) {
    if (params.executiveMemory.campanhasBoas?.length) {
      execLines.push(
        `Campanhas boas: ${params.executiveMemory.campanhasBoas.slice(0, 5).join("; ")}`
      );
    }
    if (params.executiveMemory.produtosBons?.length) {
      execLines.push(
        `Produtos bons: ${params.executiveMemory.produtosBons.slice(0, 5).join("; ")}`
      );
    }
    if (params.executiveMemory.errosRecorrentes?.length) {
      execLines.push(
        `Erros (Performance): ${params.executiveMemory.errosRecorrentes.slice(0, 5).join("; ")}`
      );
    }
  }

  const blocks = [
    "## AURA BRAIN — Memória & Aprendizado",
    params.aprendizadoMes ? `**Aprendizado do mês:** ${params.aprendizadoMes}` : "",
    params.estrategiasVencedoras
      ? `**Estratégias vencedoras:**\n${params.estrategiasVencedoras}`
      : "",
    params.campanhasVencedoras
      ? `**Campanhas vencedoras:**\n${params.campanhasVencedoras}`
      : "",
    params.errosRecorrentes
      ? `**Erros recorrentes:**\n${params.errosRecorrentes}`
      : "",
    execLines.length > 0 ? `**Memória executiva:**\n${execLines.join("\n")}` : "",
    params.memoriaPersistente
      ? `**Memória persistente:**\n${params.memoriaPersistente}`
      : "",
  ].filter(Boolean);

  return blocks.join("\n\n");
}
