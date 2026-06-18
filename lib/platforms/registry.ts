import { syncEduzz, testEduzzConnection } from "./eduzz.client";
import { syncHotmart, testHotmartConnection } from "./hotmart.client";
import { syncKiwify, testKiwifyConnection } from "./kiwify.client";
import { syncMonetizze, testMonetizzeConnection } from "./monetizze.client";
import { testStripeConnection } from "./stripe.client";
import type { PlatformClient, PlatformCredentials, PlatformId } from "./types";

const CLIENTS: Record<PlatformId, PlatformClient | null> = {
  kiwify: {
    id: "kiwify",
    testConnection: testKiwifyConnection,
    sync: syncKiwify,
  },
  hotmart: {
    id: "hotmart",
    testConnection: testHotmartConnection,
    sync: syncHotmart,
  },
  eduzz: {
    id: "eduzz",
    testConnection: testEduzzConnection,
    sync: syncEduzz,
  },
  monetizze: {
    id: "monetizze",
    testConnection: testMonetizzeConnection,
    sync: syncMonetizze,
  },
  meta_business: null,
  google_ads: null,
  tiktok_ads: null,
  stripe: {
    id: "stripe",
    testConnection: testStripeConnection,
    sync: async () => ({
      products: [],
      sales: [],
      affiliateProducts: [],
      revenueTotalCents: 0,
      commissionsTotalCents: 0,
      accountLabel: "Stripe",
    }),
  },
  paypal: null,
};

export function getPlatformClient(platform: PlatformId): PlatformClient | null {
  return CLIENTS[platform] ?? null;
}

export function isPlatformAvailable(platform: PlatformId): boolean {
  return CLIENTS[platform] != null;
}

export async function testPlatformConnection(
  platform: PlatformId,
  credentials: PlatformCredentials
) {
  const client = getPlatformClient(platform);
  if (!client) {
    return { ok: false, error: "Plataforma ainda não disponível nesta versão." };
  }
  return client.testConnection(credentials);
}

export async function syncPlatform(platform: PlatformId, credentials: PlatformCredentials) {
  const client = getPlatformClient(platform);
  if (!client) {
    throw new Error("Plataforma ainda não disponível nesta versão.");
  }
  return client.sync(credentials);
}
