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
  "Produto já está sendo melhorado. Aguarde terminar.";

export const PRODUCT_PRO_DEPTH_BLOCKED_MESSAGE =
  "Melhoria automática bloqueada para evitar repetição. Tente novamente manualmente.";

export const PRODUCT_PRO_LOOP_DETECTED_MESSAGE =
  "Loop detectado ao melhorar produto. A ação foi bloqueada para evitar recursão.";

export const PRODUCT_PRO_AUTO_IMPROVE_COOLDOWN_MS = 10 * 60 * 1000;

export const PRODUCT_PRO_MAX_DEPTH = 5;

export const productProLocks = new Map<string, ProductProLockEntry>();

export const productProDepthByFactory = new Map<string, number>();

const productProManualImproveAt = new Map<string, number>();

export class ProductProDepthLimitError extends Error {
  readonly factoryId: string;
  readonly depth: number;

  constructor(factoryId: string, depth: number) {
    super(`Product Pro depth limit exceeded for factory ${factoryId} at depth ${depth}`);
    this.name = "ProductProDepthLimitError";
    this.factoryId = factoryId;
    this.depth = depth;
  }
}

export function isProductProDepthLimitError(error: unknown): error is ProductProDepthLimitError {
  return error instanceof ProductProDepthLimitError;
}

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

export function getActiveProductProLock(
  factoryId: string
): ProductProLockEntry | null {
  clearExpiredLock(factoryId);
  return productProLocks.get(factoryId) ?? null;
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
  productProDepthByFactory.clear();
  productProManualImproveAt.clear();
}

export function pushProductProDepthForFactory(factoryId: string): number {
  const depth = (productProDepthByFactory.get(factoryId) ?? 0) + 1;
  productProDepthByFactory.set(factoryId, depth);
  if (depth > PRODUCT_PRO_MAX_DEPTH) {
    productProDepthByFactory.set(factoryId, Math.max(0, depth - 1));
    throw new ProductProDepthLimitError(factoryId, depth);
  }
  return depth;
}

export function popProductProDepthForFactory(factoryId: string): void {
  const depth = productProDepthByFactory.get(factoryId) ?? 0;
  if (depth <= 1) {
    productProDepthByFactory.delete(factoryId);
    return;
  }
  productProDepthByFactory.set(factoryId, depth - 1);
}

export function getProductProDepthForFactory(factoryId: string): number {
  return productProDepthByFactory.get(factoryId) ?? 0;
}

export function recordManualProductProImprove(factoryId: string, now = Date.now()): void {
  productProManualImproveAt.set(factoryId, now);
}

export function isProductProAutoImproveInCooldown(factoryId: string, now = Date.now()): boolean {
  const improvedAt = productProManualImproveAt.get(factoryId);
  if (!improvedAt) return false;
  if (now - improvedAt >= PRODUCT_PRO_AUTO_IMPROVE_COOLDOWN_MS) {
    productProManualImproveAt.delete(factoryId);
    return false;
  }
  return true;
}

export const PRODUCT_PRO_NO_AUTO_IMPROVE_MODULES = [
  "product-factory-pro",
  "manual",
  "passive",
] as const;

export function shouldSkipEbookAutoImprovement(sourceModule: string): boolean {
  return (PRODUCT_PRO_NO_AUTO_IMPROVE_MODULES as readonly string[]).includes(sourceModule);
}

export function shouldScheduleExcellenceAfterProAction(
  source: ProductProActionSource | string,
  skipExcellenceTrigger?: boolean
): boolean {
  void skipExcellenceTrigger;
  void source;
  return false;
}

export function isProductProStackOverflowError(error: unknown): boolean {
  if (error instanceof RangeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    /maximum call stack size exceeded/i.test(message) ||
    /recursion detected/i.test(message)
  );
}
