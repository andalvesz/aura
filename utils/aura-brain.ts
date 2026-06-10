import type { PerformanceExecutiveMemory } from "@/utils/performance";

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
