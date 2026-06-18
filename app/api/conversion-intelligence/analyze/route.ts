import { analyzeConversion } from "@/lib/supabase/services/conversion-intelligence.service";
import type { ConversionIntelligenceIntake } from "@/utils/conversion-intelligence";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ConversionIntelligenceIntake>;

    const { result, error } = await analyzeConversion({
      funnel_id: body.funnel_id?.trim() || null,
      product_id: body.product_id?.trim() || null,
      force_refresh: body.force_refresh,
    });

    if (error || !result) {
      return Response.json({ error, result }, { status: 400 });
    }

    return Response.json({ result });
  } catch {
    return Response.json({ error: "Erro ao analisar conversões." }, { status: 500 });
  }
}
