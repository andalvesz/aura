import { generateOfferStack } from "@/lib/supabase/services/offer-engine.service";
import type { OfferEngineIntake } from "@/utils/offer-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<OfferEngineIntake>;
    const productId = body.product_id?.trim();

    if (!productId) {
      return Response.json({ error: "Informe product_id." }, { status: 400 });
    }

    const { bundle, error } = await generateOfferStack({
      product_id: productId,
      funnel_id: body.funnel_id?.trim() || null,
      factory_id: body.factory_id?.trim() || null,
      front_price: body.front_price,
      currency: body.currency?.trim(),
      country: body.country?.trim(),
    });

    if (error || !bundle) {
      return Response.json({ error, bundle }, { status: 400 });
    }

    return Response.json({ bundle });
  } catch {
    return Response.json({ error: "Erro ao gerar stack de ofertas." }, { status: 500 });
  }
}
