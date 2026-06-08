import { createGoal, listGoals, syncGoalsProgress } from "@/lib/supabase/services/goals.service";
import { logApiError, logAuthFailure } from "@/lib/logs/record";
import type { GoalTipo } from "@/types/database";
import { parseRequestJson } from "@/utils/safe-json";

const VALID_TIPOS = new Set<GoalTipo>([
  "financeira",
  "saude",
  "conteudo",
  "vendas",
  "eventos",
  "idiomas",
  "personalizada",
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shouldSync = searchParams.get("sync") !== "false";

    const { goals, error } = shouldSync
      ? await syncGoalsProgress()
      : await listGoals();

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      if (status === 401) logAuthFailure("/api/goals", error);
      else logApiError("metas", "/api/goals", error, status);
      return Response.json({ error }, { status });
    }

    return Response.json({ goals });
  } catch (error) {
    console.error("[goals] GET", error);
    return Response.json({ error: "Erro ao carregar metas." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      titulo?: string;
      tipo?: string;
      meta?: number;
      data_inicio?: string;
      data_fim?: string;
      atual?: number;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const titulo = body.titulo?.trim();
    const tipo = body.tipo as GoalTipo;
    const meta = Number(body.meta);

    if (!titulo || !tipo || !VALID_TIPOS.has(tipo) || !meta || meta <= 0) {
      return Response.json({ error: "Preencha título, tipo e meta válidos." }, { status: 400 });
    }

    if (!body.data_inicio || !body.data_fim || body.data_fim < body.data_inicio) {
      return Response.json({ error: "Datas inválidas." }, { status: 400 });
    }

    const { goal, error } = await createGoal({
      titulo,
      tipo,
      meta,
      data_inicio: body.data_inicio,
      data_fim: body.data_fim,
      atual: body.atual ?? 0,
      status: "ativa",
    });

    if (error || !goal) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error: error ?? "Erro ao criar meta." }, { status });
    }

    return Response.json({ goal });
  } catch (error) {
    console.error("[goals] POST", error);
    return Response.json({ error: "Erro ao criar meta." }, { status: 500 });
  }
}
