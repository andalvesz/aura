import { decryptCredentials, encryptCredentials } from "@/lib/crypto/credentials";
import { syncKiwify, testKiwifyConnection } from "@/lib/platforms/kiwify.client";
import {
  KiwifyCommissionsRepository,
  KiwifyConnectionsRepository,
  KiwifyProductsRepository,
  KiwifySalesRepository,
} from "@/lib/supabase/repositories/kiwify-connect.repository";
import type { Json, KiwifyProduct } from "@/types/database";
import { getOptionalDataContext } from "./context";
import { logIntegrationAction } from "./integration-logs.service";
import { recordPlatformResult } from "./platform-results.service";

function scoreAffiliateProduct(product: {
  priceCents: number | null;
  affiliateEnabled: boolean;
  commissionCents: number | null;
}): number {
  let score = 40;
  if (product.affiliateEnabled) score += 25;
  if (product.priceCents && product.priceCents >= 5000) score += 15;
  if (product.commissionCents && product.commissionCents >= 1000) score += 20;
  return Math.min(100, score);
}

export async function getKiwifyConnectDashboard() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado.", data: null };

  const connRepo = new KiwifyConnectionsRepository(ctx.supabase, ctx.userId);
  const productsRepo = new KiwifyProductsRepository(ctx.supabase, ctx.userId);
  const salesRepo = new KiwifySalesRepository(ctx.supabase, ctx.userId);
  const commissionsRepo = new KiwifyCommissionsRepository(ctx.supabase, ctx.userId);

  const [connection, productsRes, salesRes, commissionsRes] = await Promise.all([
    connRepo.findForUser(),
    productsRepo.findAllOrdered(),
    salesRepo.findRecent(30),
    commissionsRepo.findRecent(30),
  ]);

  const products = productsRes.data ?? [];
  const sales = salesRes.data ?? [];
  const commissions = commissionsRes.data ?? [];

  const revenueTotal = sales.reduce((sum, s) => sum + s.net_cents, 0);
  const commissionsTotal = commissions.reduce((sum, c) => sum + c.amount_cents, 0);
  const topAffiliate = products.filter((p) => p.affiliate_enabled).slice(0, 5);

  return {
    error: null,
    data: {
      connection: connection.data,
      products,
      sales,
      commissions,
      revenueTotalCents: revenueTotal,
      commissionsTotalCents: commissionsTotal,
      topAffiliateProducts: topAffiliate,
    },
  };
}

export async function connectKiwify(params: {
  clientId: string;
  clientSecret: string;
  accountId: string;
  accountLabel?: string;
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const credentials = {
    client_id: params.clientId.trim(),
    client_secret: params.clientSecret.trim(),
    account_id: params.accountId.trim(),
  };

  const test = await testKiwifyConnection(credentials);
  if (!test.ok) return { error: test.error ?? "Falha ao conectar Kiwify." };

  const encrypted = encryptCredentials(credentials);
  const connRepo = new KiwifyConnectionsRepository(ctx.supabase, ctx.userId);
  const existing = await connRepo.findForUser();

  const payload = {
    account_id: credentials.account_id,
    credentials_encrypted: encrypted,
    status: "connected" as const,
    account_label: params.accountLabel?.trim() || test.label || null,
    last_sync_at: null,
    last_error: null,
    metadata: {} as Json,
  };

  if (existing.data) {
    const { error } = await connRepo.update(existing.data.id, payload);
    if (error) return { error };
  } else {
    const { error } = await connRepo.create(payload);
    if (error) return { error };
  }

  await logIntegrationAction({
    platform: "kiwify",
    actionType: "connect",
    status: "success",
    message: "Kiwify conectada com sucesso.",
  });

  return { error: null };
}

export async function disconnectKiwify() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const connRepo = new KiwifyConnectionsRepository(ctx.supabase, ctx.userId);
  const existing = await connRepo.findForUser();
  if (!existing.data) return { error: null };

  await connRepo.update(existing.data.id, {
    status: "disconnected",
    credentials_encrypted: "",
    last_error: null,
  });

  await logIntegrationAction({
    platform: "kiwify",
    actionType: "disconnect",
    status: "success",
    message: "Kiwify desconectada.",
  });

  return { error: null };
}

export async function syncKiwifyConnection() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const connRepo = new KiwifyConnectionsRepository(ctx.supabase, ctx.userId);
  const productsRepo = new KiwifyProductsRepository(ctx.supabase, ctx.userId);
  const salesRepo = new KiwifySalesRepository(ctx.supabase, ctx.userId);
  const commissionsRepo = new KiwifyCommissionsRepository(ctx.supabase, ctx.userId);

  const { data: connection } = await connRepo.findForUser();
  if (!connection || connection.status !== "connected") {
    return { error: "Conecte a Kiwify primeiro." };
  }

  try {
    const credentials = decryptCredentials(connection.credentials_encrypted);
    const sync = await syncKiwify(credentials);

    const productIdMap = new Map<string, string>();

    for (const product of sync.products) {
      const affiliateScore = scoreAffiliateProduct({
        priceCents: product.priceCents,
        affiliateEnabled: product.affiliateEnabled,
        commissionCents: null,
      });

      const existing = await ctx.supabase
        .from("kiwify_products")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("external_product_id", product.externalId)
        .maybeSingle();

      const payload = {
        connection_id: connection.id,
        external_product_id: product.externalId,
        name: product.name,
        price_cents: product.priceCents,
        currency: product.currency,
        status: product.status,
        affiliate_enabled: product.affiliateEnabled,
        affiliate_score: affiliateScore,
        last_synced_at: new Date().toISOString(),
        metadata: {} as Json,
      };

      if (existing.data?.id) {
        await productsRepo.update(existing.data.id, payload);
        productIdMap.set(product.externalId, existing.data.id);
      } else {
        const { data: created } = await productsRepo.create(payload);
        if (created) productIdMap.set(product.externalId, created.id);
      }
    }

    for (const affiliate of sync.affiliateProducts) {
      const score = scoreAffiliateProduct({
        priceCents: affiliate.priceCents,
        affiliateEnabled: affiliate.affiliateEnabled,
        commissionCents: affiliate.commissionCents,
      });

      const existing = await ctx.supabase
        .from("kiwify_products")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("external_product_id", affiliate.externalId)
        .maybeSingle();

      const payload = {
        connection_id: connection.id,
        external_product_id: affiliate.externalId,
        name: affiliate.name,
        price_cents: affiliate.priceCents,
        currency: affiliate.currency,
        status: affiliate.status,
        affiliate_enabled: true,
        affiliate_score: score,
        last_synced_at: new Date().toISOString(),
        metadata: (affiliate.metadata ?? {}) as Json,
      };

      if (existing.data?.id) {
        await productsRepo.update(existing.data.id, payload);
      } else {
        await productsRepo.create(payload);
      }
    }

    for (const sale of sync.sales) {
      const existing = await ctx.supabase
        .from("kiwify_sales")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("external_sale_id", sale.externalId)
        .maybeSingle();

      const productId = sale.productId ? productIdMap.get(sale.productId) ?? null : null;
      const payload = {
        connection_id: connection.id,
        external_sale_id: sale.externalId,
        product_id: productId,
        external_product_id: sale.productId ?? null,
        product_name: sale.productName,
        status: sale.status,
        gross_cents: sale.grossCents,
        net_cents: sale.netCents,
        commission_cents: sale.commissionCents,
        currency: sale.currency,
        sold_at: sale.soldAt,
        metadata: {} as Json,
      };

      let saleId = existing.data?.id;
      if (existing.data?.id) {
        await salesRepo.update(existing.data.id, payload);
      } else {
        const { data: created } = await salesRepo.create(payload);
        saleId = created?.id;
      }

      if (sale.commissionCents > 0 && saleId) {
        await commissionsRepo.create({
          connection_id: connection.id,
          sale_id: saleId,
          external_commission_id: sale.externalId,
          product_name: sale.productName,
          amount_cents: sale.commissionCents,
          currency: sale.currency,
          status: "paid",
          metadata: {} as Json,
        });
      }
    }

    await recordPlatformResult({
      platform: "kiwify",
      resultType: "sync_summary",
      title: "Sincronização Kiwify",
      summary: `${sync.products.length} produtos · ${sync.sales.length} vendas`,
      valueCents: sync.revenueTotalCents,
      currency: "BRL",
      metrics: {
        products: sync.products.length,
        sales: sync.sales.length,
        commissionsTotalCents: sync.commissionsTotalCents,
      },
      routedTo: ["performance", "money", "ceo"],
    });

    await recordPlatformResult({
      platform: "kiwify",
      resultType: "revenue",
      title: "Receita Kiwify (30 dias)",
      summary: `Receita líquida sincronizada da Kiwify`,
      valueCents: sync.revenueTotalCents,
      currency: "BRL",
      routedTo: ["money", "ceo"],
    });

    const topProducts = await productsRepo.findAllOrdered();
    const best = (topProducts.data ?? [])
      .filter((p) => p.affiliate_enabled)
      .slice(0, 3);

    if (best.length > 0) {
      await recordPlatformResult({
        platform: "kiwify",
        resultType: "affiliate_analysis",
        title: "Melhores produtos para afiliação",
        summary: best.map((p) => p.name).join(", "),
        metrics: { products: best.map((p: KiwifyProduct) => ({ id: p.id, name: p.name, score: p.affiliate_score })) },
        routedTo: ["performance", "money", "ceo"],
      });
    }

    await connRepo.update(connection.id, {
      last_sync_at: new Date().toISOString(),
      last_error: null,
    });

    await logIntegrationAction({
      platform: "kiwify",
      actionType: "sync",
      status: "success",
      message: "Sincronização Kiwify concluída.",
      details: {
        products: sync.products.length,
        sales: sync.sales.length,
      },
    });

    void import("./kiwify-intelligence.service")
      .then(({ feedKiwifyIntelligenceAfterSync }) => feedKiwifyIntelligenceAfterSync())
      .catch(() => undefined);

    return {
      error: null,
      synced: {
        products: sync.products.length,
        sales: sync.sales.length,
        revenueTotalCents: sync.revenueTotalCents,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na sincronização Kiwify.";
    await connRepo.update(connection.id, { last_error: message, status: "error" });
    await logIntegrationAction({
      platform: "kiwify",
      actionType: "sync",
      status: "error",
      message,
    });
    return { error: message };
  }
}

export async function analyzeKiwifyAffiliateProducts() {
  const dashboard = await getKiwifyConnectDashboard();
  if (dashboard.error || !dashboard.data) {
    return { error: dashboard.error ?? "Erro ao analisar.", analysis: null };
  }

  const ranked = dashboard.data.products
    .filter((p) => p.affiliate_enabled)
    .sort((a, b) => (b.affiliate_score ?? 0) - (a.affiliate_score ?? 0))
    .slice(0, 10);

  await recordPlatformResult({
    platform: "kiwify",
    resultType: "affiliate_analysis",
    title: "Análise de afiliação Kiwify",
    summary: ranked.map((p) => `${p.name} (score ${p.affiliate_score ?? 0})`).join(" · "),
    metrics: { ranked: ranked.map((p) => ({ id: p.id, name: p.name, score: p.affiliate_score })) },
    routedTo: ["performance", "money", "ceo"],
  });

  return { error: null, analysis: ranked };
}
