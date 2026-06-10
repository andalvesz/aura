import type { NormalizedAffiliateProduct } from "./types";

const KIWIFY_BASE = "https://public-api.kiwify.com.br/v1";

type KiwifyTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  message?: string;
};

type Paginated<T> = {
  pagination?: { count?: number; page_number?: number; page_size?: number };
  data?: T[];
};

async function getKiwifyToken(credentials: Record<string, string>): Promise<string> {
  const clientId = credentials.client_id?.trim();
  const clientSecret = credentials.client_secret?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Kiwify requer client_id e client_secret.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${KIWIFY_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as KiwifyTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.message ?? data.error ?? "Falha na autenticação Kiwify.");
  }
  return data.access_token;
}

async function kiwifyFetch<T>(
  path: string,
  credentials: Record<string, string>,
  token: string
): Promise<T> {
  const accountId = credentials.account_id?.trim();
  if (!accountId) {
    throw new Error("Kiwify requer account_id (x-kiwify-account-id).");
  }

  const res = await fetch(`${KIWIFY_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-kiwify-account-id": accountId,
      Accept: "application/json",
    },
  });

  const data = (await res.json()) as T & { message?: string; error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message ??
        (data as { error?: string }).error ??
        `Erro Kiwify (${res.status}).`
    );
  }
  return data;
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function testKiwifyConnection(credentials: Record<string, string>) {
  try {
    const token = await getKiwifyToken(credentials);
    await kiwifyFetch<Paginated<{ id: string; name: string }>>(
      "/products?page_size=1&page_number=1",
      credentials,
      token
    );
    const label = credentials.account_id?.trim() ?? "Kiwify";
    return { ok: true, label: `Kiwify · ${label}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao conectar Kiwify.",
    };
  }
}

export async function syncKiwify(credentials: Record<string, string>) {
  const token = await getKiwifyToken(credentials);

  const [productsRes, salesRes, affiliatesRes] = await Promise.all([
    kiwifyFetch<
      Paginated<{
        id: string;
        name: string;
        price: number | null;
        currency?: string;
        status?: string;
        affiliate_enabled?: boolean;
      }>
    >("/products?page_size=100&page_number=1", credentials, token),
    kiwifyFetch<
      Paginated<{
        id: string;
        status?: string;
        created_at?: string;
        product?: { id?: string; name?: string };
        payment?: { charge_amount?: number; net_amount?: number; product_base_price?: number };
        affiliate_commission?: { amount?: number | string };
      }>
    >(
      `/sales?start_date=${isoDateDaysAgo(30)}&end_date=${todayIso()}&page_size=100&page_number=1&view_full_sale_details=true`,
      credentials,
      token
    ),
    kiwifyFetch<
      Paginated<{
        affiliate_id?: string;
        name?: string;
        product?: { id?: string; name?: string };
        commission?: number;
        status?: string;
      }>
    >("/affiliates?page_size=100&page_number=1", credentials, token),
  ]);

  const products = (productsRes.data ?? []).map((p) => ({
    externalId: p.id,
    name: p.name,
    priceCents: p.price != null ? Math.round(p.price) : null,
    currency: p.currency ?? "BRL",
    status: p.status ?? "active",
    affiliateEnabled: Boolean(p.affiliate_enabled),
  }));

  const sales = (salesRes.data ?? []).map((s) => ({
    externalId: s.id,
    productId: s.product?.id ?? null,
    productName: s.product?.name ?? null,
    status: s.status ?? "unknown",
    grossCents: Math.round(s.payment?.charge_amount ?? s.payment?.product_base_price ?? 0),
    netCents: Math.round(s.payment?.net_amount ?? 0),
    commissionCents: Math.round(Number(s.affiliate_commission?.amount ?? 0)),
    currency: "BRL",
    soldAt: s.created_at ?? new Date().toISOString(),
  }));

  const affiliateProducts: NormalizedAffiliateProduct[] = (affiliatesRes.data ?? []).map((a) => ({
    externalId: a.product?.id ?? a.affiliate_id ?? crypto.randomUUID(),
    name: a.product?.name ?? a.name ?? "Produto afiliado",
    priceCents: null,
    commissionCents: a.commission != null ? Math.round(a.commission) : null,
    commissionPct: null,
    currency: "BRL",
    status: a.status ?? "active",
    affiliateEnabled: true,
    metadata: { affiliate_name: a.name },
  }));

  const affiliateFromProducts: NormalizedAffiliateProduct[] = products
    .filter((p) => p.affiliateEnabled)
    .map((p) => ({
      externalId: p.externalId,
      name: p.name,
      priceCents: p.priceCents,
      commissionCents: null,
      commissionPct: null,
      currency: p.currency,
      status: p.status,
      affiliateEnabled: true,
      metadata: {},
    }));

  const mergedAffiliateMap = new Map<string, NormalizedAffiliateProduct>();
  for (const item of [...affiliateProducts, ...affiliateFromProducts]) {
    mergedAffiliateMap.set(item.externalId, item);
  }

  const revenueTotalCents = sales.reduce((sum, s) => sum + s.netCents, 0);
  const commissionsTotalCents = sales.reduce((sum, s) => sum + s.commissionCents, 0);

  return {
    products,
    sales,
    affiliateProducts: [...mergedAffiliateMap.values()],
    revenueTotalCents,
    commissionsTotalCents,
    accountLabel: credentials.account_id?.trim(),
  };
}
