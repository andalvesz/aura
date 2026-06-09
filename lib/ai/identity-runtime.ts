import OpenAI, { APIError } from "openai";
import type { AiModule } from "@/types/database";
import { getUserLegacyContext } from "@/lib/supabase/services/identity.service";
import {
  buildIdentityCommandInstruction,
  detectIdentityCommand,
  type IdentityCommand,
} from "@/utils/identity";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const IDENTITY_MODULE_LABELS: Partial<Record<AiModule, string>> = {
  aura_central: "Aura Central",
  social: "Social Media",
  idiomas: "English Coach",
  agenda: "Travel",
  legado: "Aura Legado",
  creator: "Aura Creator",
};

function resolveIdentityError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return "Não foi possível gerar resposta com base no legado.";
}

export async function injectIdentityIntoPrompt(
  systemPrompt: string
): Promise<string> {
  if (systemPrompt.includes("AURA IDENTITY")) return systemPrompt;

  const { context } = await getUserLegacyContext();
  if (!context) return systemPrompt;
  return `${systemPrompt}\n\n${context}`;
}

export async function resolveIdentityCommandResponse(params: {
  message: string;
  module: AiModule;
  command?: IdentityCommand;
}): Promise<{ text: string; command: IdentityCommand } | null> {
  const command = params.command ?? detectIdentityCommand(params.message);
  if (!command) return null;

  const { context, hasLegacy } = await getUserLegacyContext();

  if (!hasLegacy || !context) {
    return {
      command,
      text:
        "Ainda não encontrei dados no seu Legado. Cadastre sua trajetória em **Legado** para eu usar sua história como base nas respostas.",
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      command,
      text: "Configure OPENAI_API_KEY para gerar respostas personalizadas com base no seu legado.",
    };
  }

  const moduleLabel = IDENTITY_MODULE_LABELS[params.module] ?? "Aura";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${context}

${buildIdentityCommandInstruction(command)}

Responda como ${moduleLabel} em português do Brasil.
Use markdown quando fizer sentido.`,
        },
        { role: "user", content: params.message },
      ],
    });

    const text =
      response.choices[0]?.message?.content?.trim() ??
      "Não consegui montar a resposta agora. Tente novamente.";

    return { text, command };
  } catch (error) {
    console.error("[identity-runtime]", error);
    return { text: resolveIdentityError(error), command };
  }
}

export { detectIdentityCommand };
