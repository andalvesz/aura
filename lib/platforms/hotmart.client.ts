const HOTMART_BASE = "https://developers.hotmart.com";

async function getHotmartToken(credentials: Record<string, string>): Promise<string> {
  const clientId = credentials.client_id?.trim();
  const clientSecret = credentials.client_secret?.trim();
  const basicToken = credentials.basic_token?.trim();

  if (!clientId || !clientSecret || !basicToken) {
    throw new Error("Hotmart requer client_id, client_secret e basic_token.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${HOTMART_BASE}/security/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicToken}`,
    },
    body,
  });

  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Falha na autenticação Hotmart.");
  }
  return data.access_token;
}

async function hotmartFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${HOTMART_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Erro Hotmart (${res.status}).`);
  }
  return data;
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function testHotmartConnection(credentials: Record<string, string>) {
  try {
    const token = await getHotmartToken(credentials);
    await hotmartFetch<{ items?: unknown[] }>(
      "/payments/api/v1/sales/history?max_results=1&start_date=" + isoDateDaysAgo(7),
      token
    );
    return { ok: true, label: "Hotmart conectado" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao conectar Hotmart.",
    };
  }
}

export async function syncHotmart(credentials: Record<string, string>) {
  const token = await getHotmartToken(credentials);
  const startDate = isoDateDaysAgo(30);

  const [productsRes, salesRes] = await Promise.all([
    hotmartFetch<{ items?: Array<{ id?: number; name?: string; status?: string; ucode?: string }> }>(
      "/payments/api/v1/products?max_results=100",
      token
    ),
    hotmartFetch<{
      items?: Array<{
        purchase?: { transaction?: string; status?: string; approved_date?: number };
        product?: { id?: number; name?: string };
        purchase_price?: { value?: number; currency_code?: string };
        commission?: { value?: number; currency_code?: string };
      }>;
    }>(`/payments/api/v1/sales/history?max_results=100&start_date=${startDate}`, token),
  ]);

  const products = (productsRes.items ?? []).map((p) => ({
    externalId: String(p.ucode ?? p.id ?? ""),
    name: p.name ?? "Produto Hotmart",
    priceCents: null,
    currency: "BRL",
    status: p.status ?? "active",
    affiliateEnabled: false,
  }));

  const sales = (salesRes.items ?? []).map((s) => ({
    externalId: s.purchase?.transaction ?? crypto.randomUUID(),
    productId: s.product?.id != null ? String(s.product.id) : null,
    productName: s.product?.name ?? null,
    status: s.purchase?.status ?? "unknown",
    grossCents: Math.round((s.purchase_price?.value ?? 0) * 100),
    netCents: Math.round((s.purchase_price?.value ?? 0) * 100),
    commissionCents: Math.round((s.commission?.value ?? 0) * 100),
    currency: s.purchase_price?.currency_code ?? "BRL",
    soldAt:
      s.purchase?.approved_date != null
        ? new Date(s.purchase.approved_date).toISOString()
        : new Date().toISOString(),
  }));

  const affiliateProducts = products.map((p) => ({
    ...p,
    commissionCents: null,
    commissionPct: null,
    affiliateEnabled: true,
  }));

  const revenueTotalCents = sales.reduce((sum, s) => sum + s.netCents, 0);
  const commissionsTotalCents = sales.reduce((sum, s) => sum + s.commissionCents, 0);

  return {
    products,
    sales,
    affiliateProducts,
    revenueTotalCents,
    commissionsTotalCents,
    accountLabel: "Hotmart",
  };
}
