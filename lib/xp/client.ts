import type { XpAcao } from "@/types/database";
import { isXpAcao } from "@/utils/xp";
import { parseJsonResponse } from "@/utils/safe-json";

export async function awardAuraXpClient(
  acao: XpAcao,
  idempotencyKey?: string
): Promise<{ awarded: boolean; duplicate?: boolean; error?: string }> {
  if (!isXpAcao(acao)) {
    return { awarded: false, error: "Ação de XP inválida." };
  }

  try {
    const res = await fetch("/api/xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      }),
    });

    const { data, error: parseError } = await parseJsonResponse<{
      awarded?: boolean;
      duplicate?: boolean;
      error?: string;
    }>(res);

    if (parseError || !res.ok) {
      return { awarded: false, error: data?.error ?? parseError ?? "Erro ao conceder XP." };
    }

    return {
      awarded: Boolean(data?.awarded),
      duplicate: Boolean(data?.duplicate),
      error: data?.error,
    };
  } catch {
    return { awarded: false, error: "Falha de rede ao conceder XP." };
  }
}

export async function refreshAuraXpClient(): Promise<void> {
  try {
    await fetch("/api/xp", { cache: "no-store" });
  } catch {
    /* noop */
  }
}

export { isXpAcao };
