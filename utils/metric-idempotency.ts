export function buildMetricIdempotencyKey(params: {
  source: string;
  entityId?: string | null;
  metricType: string;
  date: string;
}): string {
  const source = (params.source || "unknown").trim().toLowerCase();
  const entityId = (params.entityId?.trim() || "global").toLowerCase();
  const metricType = (params.metricType || "real").trim().toLowerCase();
  return `${source}:${entityId}:${metricType}:${params.date}`;
}

export function readIdempotencyKey(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).idempotency_key;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
