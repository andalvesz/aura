import { generateFunnel } from "@/lib/supabase/services/funnel-engine.service";
import type { FunnelEngineIntake } from "@/utils/funnel-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<FunnelEngineIntake>;
    const productId = body.product_id?.trim();

    if (!productId) {
      return Response.json({ error: "Informe product_id." }, { status: 400 });
    }

    const { bundle, error } = await generateFunnel({
      product_id: productId,
      operation_id: body.operation_id?.trim() || null,
      copylab_id: body.copylab_id?.trim() || null,
      factory_id: body.factory_id?.trim() || null,
      funnel_name: body.funnel_name?.trim(),
      niche: body.niche?.trim(),
      funnel_type: body.funnel_type,
      front_price: body.front_price,
      auto_generate_landing: body.auto_generate_landing,
    });

    if (error || !bundle) {
      return Response.json({ error, bundle }, { status: 400 });
    }

    return Response.json({ bundle });
  } catch {
    return Response.json({ error: "Erro ao gerar funil." }, { status: 500 });
  }
}
