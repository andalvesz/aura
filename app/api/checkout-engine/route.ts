import {
  applyCheckoutToProduct,
  createCheckout,
  getCheckoutUrl,
  syncCheckout,
} from "@/lib/supabase/services/checkout-engine.service";
import type { CheckoutPlatform } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId")?.trim();

  if (!productId) {
    return Response.json({ error: "Informe productId." }, { status: 400 });
  }

  const { checkoutUrl, checkout, error } = await getCheckoutUrl(productId);
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ checkoutUrl, checkout });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      productId?: string;
      checkoutId?: string;
      platform?: CheckoutPlatform;
      priceCents?: number;
    };

    switch (body.action ?? "create") {
      case "sync": {
        if (!body.checkoutId?.trim()) {
          return Response.json({ error: "Informe checkoutId." }, { status: 400 });
        }
        const { checkout, message, error } = await syncCheckout(body.checkoutId);
        if (error && !checkout) {
          return Response.json({ error, checkout }, { status: 422 });
        }
        return Response.json({ checkout, message, error });
      }
      case "apply": {
        if (!body.productId?.trim()) {
          return Response.json({ error: "Informe productId." }, { status: 400 });
        }
        const { updatedLandings, updatedFunnels, error } = await applyCheckoutToProduct(
          body.productId
        );
        if (error) {
          return Response.json({ error, updatedLandings, updatedFunnels }, { status: 422 });
        }
        return Response.json({ updatedLandings, updatedFunnels, error: null });
      }
      default: {
        if (!body.productId?.trim()) {
          return Response.json({ error: "Informe productId." }, { status: 400 });
        }
        const { checkout, message, error } = await createCheckout({
          productId: body.productId,
          platform: body.platform,
          priceCents: body.priceCents,
        });
        if (error && !checkout) {
          return Response.json({ error, checkout }, { status: 422 });
        }
        return Response.json({ checkout, message, error });
      }
    }
  } catch {
    return Response.json({ error: "Erro no Checkout Engine." }, { status: 500 });
  }
}
