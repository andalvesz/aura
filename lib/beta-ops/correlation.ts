/**
 * Correlation ID — stable request/operation tracing across layers.
 * Never treat as secret; never store private payloads alongside it.
 */

import { newId } from "@/lib/capabilities/store";

const HEADER = "x-correlation-id";

declare global {
  // eslint-disable-next-line no-var
  var __AURA_CORRELATION_ID__: string | undefined;
}

export function createCorrelationId(prefix = "corr"): string {
  return newId(prefix);
}

export function getRequestCorrelationId(): string {
  if (!globalThis.__AURA_CORRELATION_ID__) {
    globalThis.__AURA_CORRELATION_ID__ = createCorrelationId();
  }
  return globalThis.__AURA_CORRELATION_ID__;
}

export function setRequestCorrelationId(id: string | null | undefined): string {
  const next = id?.trim() || createCorrelationId();
  globalThis.__AURA_CORRELATION_ID__ = next;
  return next;
}

export function clearRequestCorrelationId(): void {
  globalThis.__AURA_CORRELATION_ID__ = undefined;
}

export function correlationIdFromHeaders(hdrs: {
  get(name: string): string | null;
}): string {
  const existing = hdrs.get(HEADER)?.trim() || hdrs.get("X-Correlation-Id")?.trim();
  return setRequestCorrelationId(existing);
}

export function correlationHeaderName(): string {
  return HEADER;
}

/** Sanitize for support UI — never escalate to secrets. */
export function formatCorrelationForSupport(id: string | null | undefined): string {
  if (!id) return "(nenhum)";
  return id.slice(0, 80);
}
