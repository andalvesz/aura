/**
 * Evita SyntaxError quando o corpo da resposta/requisição está vazio ou inválido.
 */

export function safeJsonParse<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

export async function readResponseText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function parseJsonResponse<T extends Record<string, unknown>>(
  res: Response
): Promise<{ data: T | null; error: string | null }> {
  const text = await readResponseText(res);
  if (!text.trim()) {
    const fallback =
      res.status === 204 || res.status === 205
        ? null
        : `Resposta vazia do servidor (${res.status}).`;
    return { data: null, error: fallback };
  }
  try {
    return { data: JSON.parse(text) as T, error: null };
  } catch {
    return { data: null, error: "Resposta inválida do servidor." };
  }
}

export async function parseRequestJson<T extends Record<string, unknown>>(
  req: Request
): Promise<{ data: T | null; error: string | null }> {
  let text = "";
  try {
    text = await req.text();
  } catch {
    return { data: null, error: "Não foi possível ler o corpo da requisição." };
  }
  if (!text.trim()) {
    return { data: null, error: "Corpo da requisição vazio." };
  }
  try {
    return { data: JSON.parse(text) as T, error: null };
  } catch {
    return { data: null, error: "JSON inválido na requisição." };
  }
}
