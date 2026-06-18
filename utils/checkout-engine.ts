import type { CheckoutPlatform, CheckoutProduct, CheckoutProductStatus, Json } from "@/types/database";

export const CHECKOUT_PLATFORMS: { id: CheckoutPlatform; label: string }[] = [
  { id: "kiwify", label: "Kiwify" },
  { id: "hotmart", label: "Hotmart" },
  { id: "stripe", label: "Stripe" },
];

export const CHECKOUT_PLATFORM_PRIORITY: CheckoutPlatform[] = ["stripe", "kiwify", "hotmart"];

export const CHECKOUT_ENGINE_SAFE_MODE = {
  active: true,
  message:
    "Checkout Engine cria links de pagamento — revise preço e plataforma antes de divulgar.",
};

export const DEFAULT_CHECKOUT_PRICE_CENTS = 9700;

export function buildKiwifyCheckoutUrl(checkoutId: string): string {
  const id = checkoutId.trim();
  return `https://pay.kiwify.com.br/${id}`;
}

export function buildHotmartCheckoutUrl(checkoutId: string): string {
  const id = checkoutId.trim();
  return `https://pay.hotmart.com/${id}`;
}

export function isCheckoutReady(status: CheckoutProductStatus): boolean {
  return status === "ready_to_sell";
}

export function mergeCheckoutMetadata(
  metadata: Json,
  patch: Record<string, unknown>
): Json {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Json;
}

export function readCheckoutUrlFromMetadata(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const url = (metadata as Record<string, unknown>).checkout_url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export function slugifyCheckoutId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "aura-product";
}

export function normalizeProductNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function scoreProductNameMatch(left: string, right: string): number {
  const a = normalizeProductNameForMatch(left);
  const b = normalizeProductNameForMatch(right);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const aTokens = new Set(a.split(/\s+/).filter((t) => t.length > 2));
  const bTokens = new Set(b.split(/\s+/).filter((t) => t.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return Math.round((overlap / Math.max(aTokens.size, bTokens.size)) * 70);
}

export type CheckoutProductSummary = {
  id: string;
  product_id: string;
  platform: CheckoutPlatform;
  checkout_url: string | null;
  status: CheckoutProductStatus;
  ready: boolean;
};

export function toCheckoutProductSummary(row: CheckoutProduct): CheckoutProductSummary {
  return {
    id: row.id,
    product_id: row.product_id,
    platform: row.platform,
    checkout_url: row.checkout_url,
    status: row.status,
    ready: isCheckoutReady(row.status) && Boolean(row.checkout_url?.trim()),
  };
}
