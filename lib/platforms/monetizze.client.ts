const MONETIZZE_BASE = "https://api.monetizze.com.br/2.0";

async function monetizzeFetch<T>(
  path: string,
  credentials: Record<string, string>
): Promise<T> {
  const consumerKey = credentials.consumer_key?.trim();
  const token = credentials.token?.trim();
  if (!consumerKey || !token) {
    throw new Error("Monetizze requer consumer_key e token.");
  }

  const url = new URL(`${MONETIZZE_BASE}${path}`);
  url.searchParams.set("consumer_key", consumerKey);
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  const data = (await res.json()) as T & { status?: string; message?: string };
  if (!res.ok || (data as { status?: string }).status === "error") {
    throw new Error(
      (data as { message?: string }).message ?? `Erro Monetizze (${res.status}).`
    );
  }
  return data;
}

export async function testMonetizzeConnection(credentials: Record<string, string>) {
  try {
    await monetizzeFetch<{ produtos?: unknown[] }>("/produtos/listar", credentials);
    return { ok: true, label: "Monetizze conectado" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao conectar Monetizze.",
    };
  }
}

export async function syncMonetizze(credentials: Record<string, string>) {
  const [productsRes, salesRes] = await Promise.all([
    monetizzeFetch<{
      produtos?: Array<{
        codigo?: string;
        nome?: string;
        preco?: string | number;
        status?: string;
        afiliacao?: string;
      }>;
    }>("/produtos/listar", credentials),
    monetizzeFetch<{
      vendas?: Array<{
        codigo_venda?: string;
        codigo_produto?: string;
        nome_produto?: string;
        valor?: string | number;
        comissao?: string | number;
        status?: string;
        data?: string;
      }>;
    }>("/vendas/listar", credentials),
  ]);

  const parseMoney = (v: string | number | undefined) => {
    if (v == null) return 0;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  const products = (productsRes.produtos ?? []).map((p) => ({
    externalId: String(p.codigo ?? ""),
    name: p.nome ?? "Produto Monetizze",
    priceCents: parseMoney(p.preco),
    currency: "BRL",
    status: p.status ?? "active",
    affiliateEnabled: p.afiliacao === "S" || p.afiliacao === "1",
  }));

  const sales = (salesRes.vendas ?? []).map((s) => ({
    externalId: String(s.codigo_venda ?? crypto.randomUUID()),
    productId: s.codigo_produto != null ? String(s.codigo_produto) : null,
    productName: s.nome_produto ?? null,
    status: s.status ?? "unknown",
    grossCents: parseMoney(s.valor),
    netCents: parseMoney(s.valor),
    commissionCents: parseMoney(s.comissao),
    currency: "BRL",
    soldAt: s.data ?? new Date().toISOString(),
  }));

  const affiliateProducts = products
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
    }));

  const revenueTotalCents = sales.reduce((sum, s) => sum + s.netCents, 0);
  const commissionsTotalCents = sales.reduce((sum, s) => sum + s.commissionCents, 0);

  return {
    products,
    sales,
    affiliateProducts,
    revenueTotalCents,
    commissionsTotalCents,
    accountLabel: "Monetizze",
  };
}
