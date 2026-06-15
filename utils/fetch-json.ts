import { parseJsonResponse } from "@/utils/safe-json";

export const DEFAULT_FETCH_TIMEOUT_MS = 25_000;

export type FetchJsonResult<T extends Record<string, unknown>> = {
  res: Response;
  data: T | null;
  error: string | null;
  timedOut: boolean;
};

export async function fetchJsonWithTimeout<T extends Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<FetchJsonResult<T>> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const { timeoutMs: _omit, ...fetchInit } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, { ...fetchInit, signal: controller.signal });
    const { data, error } = await parseJsonResponse<T>(res);
    return { res, data, error, timedOut: false };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    const message = timedOut
      ? `Tempo esgotado ao carregar (${Math.round(timeoutMs / 1000)}s).`
      : "Erro de conexão.";
    return {
      res: new Response(null, { status: timedOut ? 408 : 0 }),
      data: null,
      error: message,
      timedOut,
    };
  } finally {
    clearTimeout(timer);
  }
}
