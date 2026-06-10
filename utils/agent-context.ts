import type { AuraBrainResult } from "@/lib/supabase/services/aura-brain.service";
import {
  getAgentDefinition,
  type AuraAgentId,
  type AuraBrainSectionKey,
} from "@/utils/agent-registry";

function sectionLabel(key: AuraBrainSectionKey): string {
  const labels: Record<AuraBrainSectionKey, string> = {
    legado: "LEGADO",
    negocios: "NEGÓCIOS",
    financeiro: "FINANCEIRO",
    global: "GLOBAL",
    execucao: "EXECUÇÃO",
    memoria: "MEMÓRIA",
  };
  return labels[key];
}

function moduleDataForAgent(agentId: AuraAgentId, brain: AuraBrainResult): string {
  const data = brain.moduleData;

  switch (agentId) {
    case "ceo":
      return [
        data.metas ? `**Metas:**\n${data.metas}` : "",
        data.alvesz ? `**Alvesz:**\n${data.alvesz.slice(0, 400)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "money":
      return [
        data.money ? `**Money Missions:** ${data.money}` : "",
        data.moneyTasks ? `**Missões do dia:** ${data.moneyTasks}` : "",
        data.finance ? `**Financeiro:**\n${data.finance.slice(0, 500)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "creator":
      return [
        data.creatorSummary ? `**Produtos:**\n${data.creatorSummary}` : "",
        data.researchSummary ? `**Pesquisas:**\n${data.researchSummary}` : "",
        data.launch ? `**Lançamentos:**\n${data.launch}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "marketing":
      return [
        data.copylab ? `**CopyLab:**\n${data.copylab}` : "",
        data.launch ? `**Launch:**\n${data.launch}` : "",
        data.social ? `**Social:**\n${data.social.slice(0, 400)}` : "",
        data.platforms ? `**Plataformas:**\n${data.platforms.slice(0, 300)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "performance":
      return [
        data.autopilot ? `**Autopilot:**\n${data.autopilot.slice(0, 600)}` : "",
        brain.memoryContext ? `**Memória executiva:**\n${brain.memoryContext.slice(0, 400)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "global":
      return data.global ? `**Global Intelligence:**\n${data.global}` : "";
    case "knowledge":
      return [
        data.knowledge ? `**Knowledge:**\n${data.knowledge.slice(0, 600)}` : "",
        brain.memoryContext ? `**Aprendizados:**\n${brain.memoryContext.slice(0, 400)}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "execution":
      return [
        brain.sections.execucao ? `**Execução:**\n${brain.sections.execucao}` : "",
        data.growthMissions ? `**Missões Growth:** ${data.growthMissions}` : "",
        data.eventos ? `**Eventos:**\n${data.eventos}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    default:
      return "";
  }
}

export function buildAgentContext(agentId: AuraAgentId, brain: AuraBrainResult): string {
  const agent = getAgentDefinition(agentId);
  const sectionBlocks = agent.brainSections
    .map((key) => {
      const content = brain.sections[key]?.trim();
      if (!content) return "";
      return `### ${sectionLabel(key)}\n${content}`;
    })
    .filter(Boolean);

  const moduleBlock = moduleDataForAgent(agentId, brain);
  const blocks = [
    `## ${agent.name}`,
    `**Responsabilidades:** ${agent.responsibilities.join(", ")}`,
    sectionBlocks.length > 0 ? sectionBlocks.join("\n\n") : "",
    moduleBlock ? `### DADOS DO MÓDULO\n${moduleBlock}` : "",
  ].filter(Boolean);

  return blocks.join("\n\n");
}

export function buildMultiAgentContext(
  agentIds: AuraAgentId[],
  brain: AuraBrainResult
): string {
  const agentContexts = agentIds.map((agentId) => buildAgentContext(agentId, brain));
  return [
    "## AURA BRAIN — Sistema Multiagente",
    `Agentes consultados: ${agentIds.map((id) => getAgentDefinition(id).name).join(", ")}`,
    "",
    agentContexts.join("\n\n---\n\n"),
  ].join("\n");
}
