import OpenAI from "openai";
import {
  buildOpenAiMessagesWithMemory,
  persistAiTurn,
} from "@/lib/ai/memory-runtime";
import { injectIdentityIntoPrompt } from "@/lib/ai/identity-runtime";
import { buildAuraContext } from "@/lib/supabase/services/aura-brain.service";
import { logAgentHistory } from "@/lib/supabase/services/agent-history.service";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import {
  AURA_BRAIN_AI_CONTEXT,
  type AuraBrainAgentMode,
} from "@/utils/aura-brain";
import { buildMultiAgentContext } from "@/utils/agent-context";
import {
  getAgentDefinition,
  selectAgentsForQuery,
  type AuraAgentId,
} from "@/utils/agent-registry";
import { AURA_CENTRAL_CONTEXT } from "@/utils/orchestrator";
import { todayIsoDate } from "@/utils/health";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AuraBrainMultiAgentResult = {
  text: string;
  consultedAgents: AuraAgentId[];
  brainMode: AuraBrainAgentMode;
  error?: string;
};

function buildSynthesisInstruction(agents: AuraAgentId[]): string {
  const agentNames = agents.map((id) => getAgentDefinition(id).name).join(", ");
  return [
    "O Aura Brain coordena agentes especializados para responder com visão integrada.",
    `Agentes consultados: ${agentNames}.`,
    "Sintetize as perspectivas de cada agente em uma resposta única, estratégica e acionável.",
    "Estruture com: diagnóstico breve, recomendações por área e próximos passos prioritários.",
    "Use apenas dados do contexto. Não invente métricas.",
  ].join(" ");
}

export async function runAuraBrainMultiAgent(params: {
  message: string;
  history: ChatMessage[];
  agentIds?: AuraAgentId[];
  brainMode?: AuraBrainAgentMode;
}): Promise<AuraBrainMultiAgentResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      text: "",
      consultedAgents: [],
      brainMode: params.brainMode ?? "agents",
      error: "OPENAI_API_KEY não configurada.",
    };
  }

  const brain = await buildAuraContext();
  if (brain.error) {
    return {
      text: "",
      consultedAgents: [],
      brainMode: params.brainMode ?? "agents",
      error: brain.error,
    };
  }

  const consultedAgents =
    params.agentIds && params.agentIds.length > 0
      ? params.agentIds
      : selectAgentsForQuery(params.message);

  const brainMode = params.brainMode ?? "agents";
  const multiAgentContext = buildMultiAgentContext(consultedAgents, brain);
  const memoryContext =
    brainMode === "memory" ? `\n\n${brain.memoryContext}` : "";

  const mergedHistory = await resolveMergedHistory("aura_central", params.history);

  const systemPrompt = await injectIdentityIntoPrompt(
    `${AURA_BRAIN_AI_CONTEXT}

${AURA_CENTRAL_CONTEXT}

## INSTRUÇÃO
${buildSynthesisInstruction(consultedAgents)}

${multiAgentContext}${memoryContext}`
  );

  const messages = await buildOpenAiMessagesWithMemory({
    module: "aura_central",
    userMessage: params.message,
    systemPrompt: `${systemPrompt}
Responda como Aura Brain unificando os agentes consultados. Data de hoje: ${todayIsoDate()}.`,
    clientHistory: params.history,
    mergedHistory,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
  });

  const text =
    response.choices[0]?.message?.content ?? "Não consegui responder agora.";

  await persistAiTurn("aura_central", params.message, text, {
    kind: "brain",
    brainMode,
    consultedAgents,
  });

  await logAgentHistory({
    agentId: "brain",
    userMessage: params.message,
    agentResponse: text,
    consultedAgents,
    metadata: { brainMode },
  });

  return {
    text,
    consultedAgents,
    brainMode,
  };
}
