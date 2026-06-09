import { generateCreatorOffer } from "@/lib/supabase/services/creator.service";
import { logApiError, logAuthFailure } from "@/lib/logs/record";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{ productId?: string }>(
      req
    );

    if (bodyError || !body?.productId?.trim()) {
      return Response.json({ error: "productId obrigatório." }, { status: 400 });
    }

    const { bundle, error } = await generateCreatorOffer(body.productId.trim());

    if (error === "Usuário não autenticado.") {
      logAuthFailure("/api/creator/offer", error);
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      const status = error.includes("OPENAI") ? 503 : 500;
      logApiError("creator", "/api/creator/offer", error, status);
      return Response.json({ error }, { status });
    }

    return Response.json({ bundle });
  } catch (error) {
    console.error("[creator/offer]", error);
    logApiError("creator", "/api/creator/offer", error, 500);
    return Response.json({ error: "Erro ao gerar oferta." }, { status: 500 });
  }
}
