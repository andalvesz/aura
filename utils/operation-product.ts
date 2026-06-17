import type { KiwifyProduct, OperationCenter } from "@/types/database";

export type OperationProductSource = "creator" | "kiwify" | "kiwify_synced";

export function resolveOperationProductName(
  operation: Pick<OperationCenter, "product_nome">,
  metadata?: Record<string, unknown>
): string | null {
  const candidates = [
    operation.product_nome,
    typeof metadata?.produto === "string" ? metadata.produto : null,
    typeof metadata?.product_name === "string" ? metadata.product_name : null,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

export function normalizeProductHint(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hintMatchesName(hint: string, name: string): boolean {
  const normalizedHint = normalizeProductHint(hint);
  const normalizedName = normalizeProductHint(name);
  if (!normalizedHint || !normalizedName) return false;
  if (normalizedHint === normalizedName) return true;
  if (normalizedName.includes(normalizedHint) || normalizedHint.includes(normalizedName)) {
    return true;
  }

  const hintTokens = normalizedHint.split(" ").filter((token) => token.length > 3);
  if (hintTokens.length === 0) return false;
  const matched = hintTokens.filter((token) => normalizedName.includes(token)).length;
  return matched >= Math.min(2, hintTokens.length);
}

export function matchKiwifyProductByHints(
  products: KiwifyProduct[],
  hints: string[]
): KiwifyProduct | null {
  const cleanedHints = hints.map((hint) => hint.trim()).filter(Boolean);
  if (products.length === 0 || cleanedHints.length === 0) return null;

  for (const hint of cleanedHints) {
    const exact = products.find((product) => hintMatchesName(hint, product.name));
    if (exact) return exact;
  }

  const ranked = [...products].sort(
    (a, b) => (b.affiliate_score ?? 0) - (a.affiliate_score ?? 0)
  );
  return ranked[0] ?? null;
}

export function pickTopKiwifyCatalogProduct(
  products: KiwifyProduct[],
  topSellingNames: string[]
): KiwifyProduct | null {
  if (products.length === 0) return null;

  for (const name of topSellingNames) {
    const match = products.find((product) => hintMatchesName(name, product.name));
    if (match) return match;
  }

  const ranked = [...products].sort(
    (a, b) => (b.affiliate_score ?? 0) - (a.affiliate_score ?? 0)
  );
  return ranked[0] ?? null;
}
