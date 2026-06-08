import { awardAuraXp, getAuraXpState } from "@/lib/supabase/services/xp.service";
import { logApiError, logAuthFailure } from "@/lib/logs/record";
import { isXpAcao } from "@/utils/xp";
import { parseRequestJson } from "@/utils/safe-json";

export async function GET() {
  try {
    const { state, error } = await getAuraXpState();

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      if (status === 401) logAuthFailure("/api/xp", error);
      else logApiError("xp", "/api/xp", error, status);
      return Response.json({ error }, { status });
    }

    return Response.json({ state });
  } catch (error) {
    console.error("[xp] GET", error);
    logApiError("xp", "/api/xp", error, 500);
    return Response.json({ error: "Erro ao carregar progresso." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      acao?: string;
      idempotency_key?: string;
    }>(req);

    if (bodyError || !body?.acao || !isXpAcao(body.acao)) {
      return Response.json({ error: "Ação de XP inválida." }, { status: 400 });
    }

    const idempotencyKey =
      typeof body.idempotency_key === "string" && body.idempotency_key.trim()
        ? body.idempotency_key.trim()
        : null;

    const result = await awardAuraXp(body.acao, idempotencyKey);

    if (result.error) {
      const status = result.error === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error: result.error }, { status });
    }

    return Response.json(result);
  } catch (error) {
    console.error("[xp] POST", error);
    return Response.json({ error: "Erro ao conceder XP." }, { status: 500 });
  }
}
