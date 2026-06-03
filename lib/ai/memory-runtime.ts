import type OpenAI from "openai";
import type { AiModule } from "@/types/database";
import {
  buildMemoryRecallSection,
  saveAiExchange,
} from "@/lib/supabase/services/memory.service";
import { isMemoryRecallQuery, type MemoryChatMessage } from "@/utils/memory";

type ChatCompletionMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function buildOpenAiMessagesWithMemory(params: {
  module: AiModule;
  userMessage: string;
  systemPrompt: string;
  clientHistory?: MemoryChatMessage[];
  mergedHistory: MemoryChatMessage[];
  extraSections?: string[];
}): Promise<ChatCompletionMessageParam[]> {
  const recallSection = isMemoryRecallQuery(params.userMessage)
    ? await buildMemoryRecallSection(params.userMessage, params.module)
    : "";

  const sections = [
    params.systemPrompt,
    ...(params.extraSections ?? []),
    recallSection,
  ].filter(Boolean);

  return [
    { role: "system", content: sections.join("\n\n") },
    ...params.mergedHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: params.userMessage },
  ];
}

export async function persistAiTurn(
  module: AiModule,
  userMessage: string,
  assistantContent: string,
  metadata?: Record<string, unknown>
) {
  if (!assistantContent.trim()) return;
  await saveAiExchange(module, userMessage, assistantContent, metadata ?? {});
}
