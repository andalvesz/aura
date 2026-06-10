import {
  IntegrationConnectionsRepository,
  IntegrationEventsRepository,
  IntegrationSyncLogsRepository,
} from "@/lib/supabase/repositories/integration-center.repository";
import {
  KiwifyCommissionsRepository,
  KiwifyConnectionsRepository,
  KiwifyProductsRepository,
  KiwifySalesRepository,
} from "@/lib/supabase/repositories/kiwify-connect.repository";
import {
  MetaAdAccountsRepository,
  MetaCampaignsRepository,
  MetaConnectionsRepository,
} from "@/lib/supabase/repositories/meta.repository";
import type {
  IntegrationConnection,
  IntegrationConnectionPlatform,
  IntegrationEvent,
  IntegrationSyncLog,
  Json,
} from "@/types/database";
import {
  COMING_SOON_INTEGRATIONS,
  INTEGRATION_SYNC_INTERVAL_MS,
  integrationPlatformLabel,
  type IntegrationCenterPlatformStatus,
  type IntegrationPlatformId,
} from "@/utils/integrations";
import { getOptionalDataContext } from "./context";
import { logIntegrationEvent } from "./integration-events.service";
import { syncKiwifyConnection } from "./kiwify-connect.service";
import { syncMetaConnection } from "./meta-connect.service";

export type IntegrationCenterDashboard = {
  connections: IntegrationCenterPlatformStatus[];
  metrics: {
    importedRevenueCents: number;
    commissionsCents: number;
    activeCampaigns: number;
    activeProducts: number;
  };
  sync: {
    lastSyncAt: string | null;
    nextSyncAt: string | null;
    errors: string[];
    lastLog: IntegrationSyncLog | null;
  };
  events: IntegrationEvent[];
  recentSyncLogs: IntegrationSyncLog[];
};

function computeNextSyncAt(lastSyncAt: string | null): string | null {
  if (!lastSyncAt) return null;
  return new Date(new Date(lastSyncAt).getTime() + INTEGRATION_SYNC_INTERVAL_MS).toISOString();
}

function parseStats(value: Json): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === "number") out[key] = val;
  }
  return out;
}

export async function logIntegrationSync(params: {
  platform: IntegrationSyncLog["platform"];
  status: IntegrationSyncLog["status"];
  startedAt: string;
  recordsSynced?: number;
  message: string;
  errors?: string[];
  details?: Record<string, unknown>;
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return null;

  const repo = new IntegrationSyncLogsRepository(ctx.supabase, ctx.userId);
  const { data } = await repo.create({
    platform: params.platform,
    status: params.status,
    started_at: params.startedAt,
    finished_at: new Date().toISOString(),
    records_synced: params.recordsSynced ?? 0,
    message: params.message,
    errors: (params.errors ?? []) as Json,
    details: (params.details ?? {}) as Json,
  });

  await logIntegrationEvent({
    platform: params.platform === "all" ? "all" : params.platform,
    eventType: params.status === "error" ? "failure" : "sync",
    status: params.status === "error" ? "error" : "success",
    title: params.platform === "all" ? "Sincronização geral" : `Sync ${integrationPlatformLabel(params.platform)}`,
    message: params.message,
    details: { errors: params.errors ?? [], recordsSynced: params.recordsSynced ?? 0 },
  });

  return data;
}

export async function upsertIntegrationConnection(params: {
  platform: IntegrationPlatformId;
  status: IntegrationConnection["status"];
  accountLabel?: string | null;
  stats?: Record<string, number>;
  lastSyncAt?: string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const repo = new IntegrationConnectionsRepository(ctx.supabase, ctx.userId);
  const existing = await repo.findByPlatform(params.platform);
  const lastSyncAt = params.lastSyncAt ?? existing.data?.last_sync_at ?? null;
  const payload = {
    status: params.status,
    account_label: params.accountLabel ?? existing.data?.account_label ?? null,
    stats: (params.stats ?? parseStats(existing.data?.stats ?? {})) as Json,
    metadata: (params.metadata ?? existing.data?.metadata ?? {}) as Json,
    last_sync_at: lastSyncAt,
    next_sync_at: computeNextSyncAt(lastSyncAt),
    last_error: params.lastError ?? null,
  };

  if (existing.data) {
    await repo.update(existing.data.id, payload);
  } else {
    await repo.create({
      platform: params.platform,
      ...payload,
    });
  }
}

export async function refreshIntegrationConnectionsFromSources() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const metaRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const kiwifyRepo = new KiwifyConnectionsRepository(ctx.supabase, ctx.userId);
  const accountsRepo = new MetaAdAccountsRepository(ctx.supabase, ctx.userId);
  const campaignsRepo = new MetaCampaignsRepository(ctx.supabase, ctx.userId);
  const productsRepo = new KiwifyProductsRepository(ctx.supabase, ctx.userId);

  const [metaConn, kiwifyConn, accounts, campaigns, products] = await Promise.all([
    metaRepo.findForUser(),
    kiwifyRepo.findForUser(),
    accountsRepo.findAllOrdered(),
    campaignsRepo.findAllOrdered(),
    productsRepo.findAllOrdered(),
  ]);

  const meta = metaConn.data;
  if (meta) {
    const activeCampaigns = (campaigns.data ?? []).filter((c) => c.status === "active").length;
    await upsertIntegrationConnection({
      platform: "meta",
      status: meta.status,
      accountLabel: meta.business_name,
      lastSyncAt: meta.last_sync_at,
      lastError: meta.last_error,
      stats: {
        campaigns: (campaigns.data ?? []).length,
        activeCampaigns,
        accounts: (accounts.data ?? []).length,
      },
    });
  } else {
    await upsertIntegrationConnection({
      platform: "meta",
      status: "disconnected",
      stats: { campaigns: 0, activeCampaigns: 0, accounts: 0 },
    });
  }

  const kiwify = kiwifyConn.data;
  if (kiwify) {
    const productList = products.data ?? [];
    await upsertIntegrationConnection({
      platform: "kiwify",
      status: kiwify.status,
      accountLabel: kiwify.account_label,
      lastSyncAt: kiwify.last_sync_at,
      lastError: kiwify.last_error,
      stats: {
        products: productList.length,
        activeProducts: productList.filter((p) => p.status === "active").length,
        affiliates: productList.filter((p) => p.affiliate_enabled).length,
      },
    });
  } else {
    await upsertIntegrationConnection({
      platform: "kiwify",
      status: "disconnected",
      stats: { products: 0, activeProducts: 0, affiliates: 0, sales: 0 },
    });
  }

  for (const platform of COMING_SOON_INTEGRATIONS) {
    const repo = new IntegrationConnectionsRepository(ctx.supabase, ctx.userId);
    const existing = await repo.findByPlatform(platform);
    if (!existing.data) {
      await repo.create({
        platform,
        status: "coming_soon",
        account_label: null,
        stats: {} as Json,
        metadata: {} as Json,
        last_sync_at: null,
        next_sync_at: null,
        last_error: null,
      });
    }
  }
}

export async function getIntegrationCenterDashboard(): Promise<{
  error: string | null;
  data: IntegrationCenterDashboard | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado.", data: null };

  await refreshIntegrationConnectionsFromSources();

  const connRepo = new IntegrationConnectionsRepository(ctx.supabase, ctx.userId);
  const syncRepo = new IntegrationSyncLogsRepository(ctx.supabase, ctx.userId);
  const eventsRepo = new IntegrationEventsRepository(ctx.supabase, ctx.userId);
  const salesRepo = new KiwifySalesRepository(ctx.supabase, ctx.userId);
  const commissionsRepo = new KiwifyCommissionsRepository(ctx.supabase, ctx.userId);
  const campaignsRepo = new MetaCampaignsRepository(ctx.supabase, ctx.userId);
  const productsRepo = new KiwifyProductsRepository(ctx.supabase, ctx.userId);

  const [connectionsRes, syncLogsRes, eventsRes, latestSyncRes, salesRes, commissionsRes, campaignsRes, productsRes] =
    await Promise.all([
      connRepo.findAllOrdered(),
      syncRepo.findRecent(10),
      eventsRepo.findRecent(20),
      syncRepo.findLatest(),
      salesRepo.findRecent(30),
      commissionsRepo.findRecent(30),
      campaignsRepo.findAllOrdered(),
      productsRepo.findAllOrdered(),
    ]);

  const connections = connectionsRes.data ?? [];
  const platformStatuses: IntegrationCenterPlatformStatus[] = connections.map((conn) => ({
    platform: conn.platform,
    label: integrationPlatformLabel(conn.platform),
    status: conn.status,
    accountLabel: conn.account_label,
    stats: parseStats(conn.stats),
    lastSyncAt: conn.last_sync_at,
    nextSyncAt: conn.next_sync_at,
    lastError: conn.last_error,
    comingSoon: conn.status === "coming_soon",
  }));

  const importedRevenueCents = (salesRes.data ?? []).reduce((sum, s) => sum + s.net_cents, 0);
  const commissionsCents = (commissionsRes.data ?? []).reduce((sum, c) => sum + c.amount_cents, 0);
  const activeCampaigns = (campaignsRes.data ?? []).filter((c) => c.status === "active").length;
  const activeProducts = (productsRes.data ?? []).filter((p) => p.status === "active").length;

  const connected = connections.filter((c) => c.status === "connected");
  const lastSyncCandidates = connected
    .map((c) => c.last_sync_at)
    .filter((v): v is string => Boolean(v));
  const lastSyncAt =
    latestSyncRes.data?.finished_at ??
    latestSyncRes.data?.started_at ??
    (lastSyncCandidates.length > 0
      ? lastSyncCandidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]!
      : null);

  const errors = [
    ...connections.filter((c) => c.last_error).map((c) => `${integrationPlatformLabel(c.platform)}: ${c.last_error}`),
    ...(latestSyncRes.data?.errors && Array.isArray(latestSyncRes.data.errors)
      ? (latestSyncRes.data.errors as string[])
      : []),
  ];

  return {
    error: null,
    data: {
      connections: platformStatuses,
      metrics: {
        importedRevenueCents,
        commissionsCents,
        activeCampaigns,
        activeProducts,
      },
      sync: {
        lastSyncAt,
        nextSyncAt: computeNextSyncAt(lastSyncAt),
        errors,
        lastLog: latestSyncRes.data,
      },
      events: eventsRes.data ?? [],
      recentSyncLogs: syncLogsRes.data ?? [],
    },
  };
}

export async function syncAllIntegrations() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." as const, data: null };

  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let recordsSynced = 0;
  const details: Record<string, unknown> = {};

  const metaResult = await syncMetaConnection();
  if (metaResult.error) {
    if (!metaResult.error.includes("Conecte Meta")) errors.push(`Meta: ${metaResult.error}`);
  } else {
    recordsSynced += (metaResult as { synced?: number }).synced ?? 1;
    details.meta = "ok";
  }

  const kiwifyResult = await syncKiwifyConnection();
  if (kiwifyResult.error) {
    if (!kiwifyResult.error.includes("Conecte a Kiwify")) errors.push(`Kiwify: ${kiwifyResult.error}`);
  } else {
    recordsSynced += (kiwifyResult as { synced?: number }).synced ?? 1;
    details.kiwify = "ok";
  }

  await refreshIntegrationConnectionsFromSources();

  const status = errors.length === 0 ? "success" : recordsSynced > 0 ? "partial" : "error";
  const message =
    errors.length === 0
      ? "Todas as integrações conectadas foram sincronizadas."
      : recordsSynced > 0
        ? "Sincronização parcial — algumas plataformas falharam."
        : "Nenhuma integração conectada para sincronizar.";

  await logIntegrationSync({
    platform: "all",
    status,
    startedAt,
    recordsSynced,
    message,
    errors,
    details,
  });

  const dashboard = await getIntegrationCenterDashboard();

  return {
    error: status === "error" && recordsSynced === 0 ? errors.join(" ") || message : null,
    data: dashboard.data,
  };
}

export async function getIntegrationCenterSummaryForCeo() {
  const { data } = await getIntegrationCenterDashboard();
  if (!data) return null;
  return data;
}
