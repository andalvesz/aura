export type PlatformId =
  | "kiwify"
  | "hotmart"
  | "eduzz"
  | "monetizze"
  | "meta_business"
  | "google_ads"
  | "tiktok_ads"
  | "stripe"
  | "paypal";

export type PlatformAuthType = "api_key" | "token" | "oauth";

export type PlatformConnectionStatus = "connected" | "disconnected" | "error";

export type PlatformCredentials = Record<string, string>;

export type NormalizedProduct = {
  externalId: string;
  name: string;
  priceCents: number | null;
  currency: string;
  status: string;
  affiliateEnabled: boolean;
  metadata?: Record<string, unknown>;
};

export type NormalizedSale = {
  externalId: string;
  productId: string | null;
  productName: string | null;
  status: string;
  grossCents: number;
  netCents: number;
  commissionCents: number;
  currency: string;
  soldAt: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedAffiliateProduct = {
  externalId: string;
  name: string;
  priceCents: number | null;
  commissionCents: number | null;
  commissionPct: number | null;
  currency: string;
  status: string;
  affiliateEnabled: boolean;
  metadata?: Record<string, unknown>;
};

export type PlatformSyncResult = {
  products: NormalizedProduct[];
  sales: NormalizedSale[];
  affiliateProducts: NormalizedAffiliateProduct[];
  commissionsTotalCents: number;
  revenueTotalCents: number;
  accountLabel?: string;
};

export type PlatformClient = {
  id: PlatformId;
  testConnection(credentials: PlatformCredentials): Promise<{ ok: boolean; label?: string; error?: string }>;
  sync(credentials: PlatformCredentials): Promise<PlatformSyncResult>;
};

export type ConnectPlatformInput = {
  platform: PlatformId;
  authType: PlatformAuthType;
  credentials: PlatformCredentials;
  accountLabel?: string;
};
