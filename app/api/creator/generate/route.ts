import { generateCreatorProduct } from "@/lib/supabase/services/creator.service";
import { logApiError, logAuthFailure } from "@/lib/logs/record";
import type { CreatorProductIntake } from "@/utils/creator";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      intake?: Partial<CreatorProductIntake>;
      useAuraData?: boolean;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const useAuraData = body.useAuraData === true;

    const intake: CreatorProductIntake = {
      nicho: body.intake?.nicho?.trim() ?? "",
      conhecimento: body.intake?.conhecimento?.trim() ?? "",
      publico_alvo: body.intake?.publico_alvo?.trim() ?? "",
      objetivo_financeiro:
        typeof body.intake?.objetivo_financeiro === "number"
          ? body.intake.objetivo_financeiro
          : null,
      prazo: body.intake?.prazo?.trim() ?? "",
      target_country: body.intake?.target_country ?? "Brasil",
      target_language: body.intake?.target_language ?? "Português",
      currency: body.intake?.currency ?? "BRL",
    };

    if (
      !useAuraData &&
      (!intake.nicho || !intake.conhecimento || !intake.publico_alvo || !intake.prazo)
    ) {
      return Response.json(
        { error: "Preencha nicho, conhecimento, público-alvo e prazo." },
        { status: 400 }
      );
    }

    const { bundle, error } = await generateCreatorProduct({ intake, useAuraData });

    if (error === "Usuário não autenticado.") {
      logAuthFailure("/api/creator/generate", error);
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      const status = error.includes("OPENAI") ? 503 : 500;
      logApiError("creator", "/api/creator/generate", error, status);
      return Response.json({ error }, { status });
    }

    return Response.json({ bundle });
  } catch (error) {
    console.error("[creator/generate]", error);
    logApiError("creator", "/api/creator/generate", error, 500);
    return Response.json({ error: "Erro ao gerar produto." }, { status: 500 });
  }
}
