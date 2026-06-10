const EDUZZ_BASE = "https://api2.eduzz.com";

async function eduzzFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${EDUZZ_BASE}${path}`, {
    headers: {
      Token: token,
      Accept: "application/json",
    },
  });

  const data = (await res.json()) as T & { message?: string; error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message ??
        (data as { error?: string }).error ??
        `Erro Eduzz (${res.status}).`
    );
  }
  return data;
}

export async function testEduzzConnection(credentials: Record<string, string>) {
  const token = credentials.api_token?.trim();
  if (!token) {
    return { ok: false, error: "Eduzz requer api_token." };
  }

  try {
    await eduzzFetch<{ data?: unknown[] }>("/myeduzz/v1/products?page=1&size=1", token);
    return { ok: true, label: "Eduzz conectado" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao conectar Eduzz.",
    };
  }
}

export async function syncEduzz(credentials: Record<string, string>) {
  const token = credentials.api_token?.trim();
  if (!token) throw new Error("Eduzz requer api_token.");

  const [productsRes, salesRes] = await Promise.all([
    eduzzFetch<{
      data?: Array<{
        id?: number;
        title?: string;
        price?: number;
        status?: string;
        affiliate?: { active?: boolean; commission?: number };
      }>;
    }>("/myeduzz/v1/products?page=1&size=100", token),
    eduzzFetch<{
      data?: Array<{
        id?: number;
        product?: { id?: number; title?: string };
        value?: number;
        commission?: number;
        status?: string;
        created_at?: string;
      }>;
    }>("/myeduzz/v1/sales?page=1&size=100", token),
  ]);

  const products = (productsRes.data ?? []).map((p) => ({
    externalId: String(p.id ?? ""),
    name: p.title ?? "Produto Eduzz",
    priceCents: p.price != null ? Math.round(p.price * 100) : null,
    currency: "BRL",
    status: p.status ?? "active",
    affiliateEnabled: Boolean(p.affiliate?.active),
  }));

  const sales = (salesRes.data ?? []).map((s) => ({
    externalId: String(s.id ?? crypto.randomUUID()),
    productId: s.product?.id != null ? String(s.product.id) : null,
    productName: s.product?.title ?? null,
    status: s.status ?? "unknown",
    grossCents: Math.round((s.value ?? 0) * 100),
    netCents: Math.round((s.value ?? 0) * 100),
    commissionCents: Math.round((s.commission ?? 0) * 100),
    currency: "BRL",
    soldAt: s.created_at ?? new Date().toISOString(),
  }));

  const affiliateProducts = products
    .filter((p) => p.affiliateEnabled)
    .map((p) => {
      const raw = productsRes.data?.find((r) => String(r.id) === p.externalId);
      return {
        externalId: p.externalId,
        name: p.name,
        priceCents: p.priceCents,
        commissionCents:
          raw?.affiliate?.commission != null
            ? Math.round(raw.affiliate.commission * 100)
            : null,
        commissionPct: null,
        currency: p.currency,
        status: p.status,
        affiliateEnabled: true,
      };
    });

  const revenueTotalCents = sales.reduce((sum, s) => sum + s.netCents, 0);
  const commissionsTotalCents = sales.reduce((sum, s) => sum + s.commissionCents, 0);

  return {
    products,
    sales,
    affiliateProducts,
    revenueTotalCents,
    commissionsTotalCents,
    accountLabel: "Eduzz",
  };
}
