import { persistAiTurn } from "@/lib/ai/memory-runtime";
import {
  assertOpenAiAvailable,
  generateSocialRoteiro,
  resolveSocialRoteiroError,
} from "@/lib/social/generate-roteiro";
import type { InstagramMarca } from "@/types/database";
import { INSTAGRAM_MARCAS } from "@/utils/instagram";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      titulo?: string;
      plataforma?: string;
      formato?: string;
      objetivo?: string;
      marca?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const plataforma = typeof body.plataforma === "string" ? body.plataforma : "instagram";
    const formato = typeof body.formato === "string" ? body.formato : "reel";
    const objetivo = typeof body.objetivo === "string" ? body.objetivo.trim() : "";

    if (!titulo) {
      return Response.json({ error: "Informe o título do conteúdo." }, { status: 400 });
    }

    const unavailable = assertOpenAiAvailable();
    if (unavailable) {
      return Response.json({ error: unavailable }, { status: 503 });
    }

    const marcaRaw = typeof body.marca === "string" ? body.marca.trim() : "";
    const marca = INSTAGRAM_MARCAS.some((m) => m.id === marcaRaw)
      ? (marcaRaw as InstagramMarca)
      : null;

    const { roteiro } = await generateSocialRoteiro({
      titulo,
      plataforma,
      formato,
      objetivo,
      marca,
    });

    const userMessage = `Roteiro: ${titulo} (${plataforma}/${formato})`;
    await persistAiTurn("social", userMessage, roteiro, { kind: "roteiro", marca });

    return Response.json({ roteiro });
  } catch (error) {
    console.error("[social-roteiro]", error);
    const message =
      error instanceof Error
        ? error.message
        : resolveSocialRoteiroError(error, "Erro ao gerar roteiro. Tente novamente.");
    const status = message.includes("OPENAI") || message.includes("IA indisponível") ? 503 : 500;
    return Response.json({ error: message }, { status });
  }
}
