import { analyzeMarketOpportunity } from "@/lib/supabase/services/research.service";
import { resolveCreatorLocale } from "@/utils/creator-locale";
import type { ResearchIntake } from "@/utils/research";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ResearchIntake>;
    const ideia = body.ideia?.trim() ?? "";
    const nicho = body.nicho?.trim() ?? "";
    const publico = body.publico?.trim() ?? "";
    const locale = resolveCreatorLocale(body);

    if (!ideia && !nicho) {
      return Response.json(
        { error: "Informe a ideia ou o nicho para analisar." },
        { status: 400 }
      );
    }

    const { record, error } = await analyzeMarketOpportunity({
      ideia,
      nicho,
      publico,
      ...locale,
    });
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ record });
  } catch {
    return Response.json({ error: "Erro ao analisar oportunidade." }, { status: 500 });
  }
}
