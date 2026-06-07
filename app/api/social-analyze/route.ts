import {
  analyzeInstagramProfile,
  upsertInstagramProfile,
} from "@/lib/supabase/services/social-analyze.service";
import type { InstagramMarca } from "@/types/database";
import { INSTAGRAM_MARCAS } from "@/utils/instagram";
import { parseRequestJson } from "@/utils/safe-json";

const VALID_MARCAS = new Set(INSTAGRAM_MARCAS.map((m) => m.id));

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      profileId?: string;
      marca?: string;
      username?: string;
      bio?: string;
      nicho?: string;
      objetivo?: string;
      frequencia_conteudo?: string;
      analyzeOnly?: boolean;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    if (body.profileId) {
      const { analysis, error } = await analyzeInstagramProfile(body.profileId);
      if (error) {
        const status = error === "Usuário não autenticado." ? 401 : 500;
        return Response.json({ error }, { status });
      }
      return Response.json({ analysis });
    }

    const marca = body.marca as InstagramMarca;
    const username = body.username?.trim();

    if (!marca || !VALID_MARCAS.has(marca) || !username) {
      return Response.json(
        { error: "Informe marca e username válidos." },
        { status: 400 }
      );
    }

    const { profile, error: upsertError } = await upsertInstagramProfile({
      marca,
      username,
      bio: body.bio,
      nicho: body.nicho,
      objetivo: body.objetivo,
      frequencia_conteudo: body.frequencia_conteudo,
    });

    if (upsertError || !profile) {
      const status = upsertError === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error: upsertError ?? "Erro ao salvar perfil." }, { status });
    }

    const { analysis, error: analyzeError } = await analyzeInstagramProfile(profile.id);
    if (analyzeError) {
      return Response.json({ profile, warning: analyzeError });
    }

    return Response.json({ profile, analysis });
  } catch (error) {
    console.error("[social-analyze] POST", error);
    return Response.json({ error: "Erro ao processar análise." }, { status: 500 });
  }
}
