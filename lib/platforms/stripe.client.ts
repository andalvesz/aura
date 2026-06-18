const STRIPE_API = "https://api.stripe.com/v1";

type StripeError = { error?: { message?: string } };

async function stripePost<T>(
  secretKey: string,
  path: string,
  body: Record<string, string>
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  const data = (await res.json()) as T & StripeError;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Erro Stripe API (${res.status}).`);
  }
  return data;
}

export async function testStripeConnection(credentials: Record<string, string>) {
  try {
    const secretKey =
      credentials.secret_key?.trim() ||
      credentials.api_key?.trim() ||
      credentials.stripe_secret_key?.trim();
    if (!secretKey) {
      return { ok: false, error: "Stripe requer secret_key." };
    }

    const res = await fetch(`${STRIPE_API}/balance`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) {
      const data = (await res.json()) as StripeError;
      return {
        ok: false,
        error: data.error?.message ?? `Erro Stripe (${res.status}).`,
      };
    }

    return { ok: true, label: "Stripe conectado" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao conectar Stripe.",
    };
  }
}

export async function createStripePaymentLink(input: {
  secretKey: string;
  productName: string;
  priceCents: number;
  currency: string;
}): Promise<{ checkoutId: string; checkoutUrl: string }> {
  const secretKey = input.secretKey.trim();
  const priceCents = Math.max(Math.round(input.priceCents), 100);
  const currency = (input.currency || "BRL").toLowerCase();

  const product = await stripePost<{ id: string }>(secretKey, "/products", {
    name: input.productName.slice(0, 250),
  });

  const price = await stripePost<{ id: string }>(secretKey, "/prices", {
    product: product.id,
    unit_amount: String(priceCents),
    currency,
  });

  const link = await stripePost<{ id: string; url: string }>(secretKey, "/payment_links", {
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": "1",
  });

  if (!link.url?.trim()) {
    throw new Error("Stripe não retornou URL do payment link.");
  }

  return { checkoutId: link.id, checkoutUrl: link.url };
}
