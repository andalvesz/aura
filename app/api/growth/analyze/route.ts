import { analyzeGrowthProfile } from "@/lib/supabase/services/growth.service";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      profileId?: string;
    }>(req);

    if (bodyError || !body?.profileId) {
      return Response.json(
        { error: bodyError ?? "Informe profileId." },
        { status: 400 }
      );
    }

    const { analysis, record, error } = await analyzeGrowthProfile(body.profileId);

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error }, { status });
    }

    return Response.json({ analysis, record });
  } catch (error) {
    console.error("[growth/analyze] POST", error);
    return Response.json({ error: "Erro ao processar análise." }, { status: 500 });
  }
}
