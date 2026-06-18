export type ProductProActionSource =
  | "manual"
  | "auto_elite"
  | "excellence"
  | "commercial_excellence";

export type ProductProLockEntry = {
  action: string;
  startedAt: number;
  source: ProductProActionSource | string;
};

export const PRODUCT_PRO_LOCK_TTL_MS = 5 * 60 * 1000;

export const PRODUCT_PRO_LOCK_MESSAGE =
  "Produto já está sendo melhorado. Aguarde a ação atual terminar.";

export const PRODUCT_PRO_LOOP_DETECTED_MESSAGE =
  "Loop detectado ao melhorar produto. A ação foi bloqueada para evitar recursão.";

export const productProLocks = new Map<string, ProductProLockEntry>();

function isLockExpired(entry: ProductProLockEntry, now = Date.now()): boolean {
  return now - entry.startedAt >= PRODUCT_PRO_LOCK_TTL_MS;
}

function clearExpiredLock(factoryId: string, now = Date.now()): void {
  const entry = productProLocks.get(factoryId);
  if (entry && isLockExpired(entry, now)) {
    productProLocks.delete(factoryId);
  }
}

export function isProductProLocked(factoryId: string): boolean {
  clearExpiredLock(factoryId);
  return productProLocks.has(factoryId);
}

export function acquireProductProLock(
  factoryId: string,
  action: string,
  source: ProductProActionSource | string
): boolean {
  clearExpiredLock(factoryId);
  if (productProLocks.has(factoryId)) {
    return false;
  }

  productProLocks.set(factoryId, {
    action,
    startedAt: Date.now(),
    source,
  });
  return true;
}

export function releaseProductProLock(factoryId: string): void {
  productProLocks.delete(factoryId);
}

export function resetProductProLocksForTests(): void {
  productProLocks.clear();
}

export function isProductProStackOverflowError(error: unknown): boolean {
  if (error instanceof RangeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    /maximum call stack size exceeded/i.test(message) ||
    /recursion detected/i.test(message)
  );
}
