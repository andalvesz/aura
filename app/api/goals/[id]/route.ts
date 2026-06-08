import { deleteGoal, updateGoal } from "@/lib/supabase/services/goals.service";
import { logApiError, logAuthFailure } from "@/lib/logs/record";
import type { GoalTipo } from "@/types/database";
import { parseRequestJson } from "@/utils/safe-json";

const VALID_TIPOS = new Set<GoalTipo>([
  "financeira",
  "saude",
  "conteudo",
  "vendas",
  "eventos",
  "personalizada",
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { data: body, error: bodyError } = await parseRequestJson<{
      titulo?: string;
      tipo?: string;
      meta?: number;
      atual?: number;
      data_inicio?: string;
      data_fim?: string;
      status?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const patch: Parameters<typeof updateGoal>[1] = {};

    if (body.titulo !== undefined) {
      const titulo = body.titulo.trim();
      if (!titulo) {
        return Response.json({ error: "Título inválido." }, { status: 400 });
      }
      patch.titulo = titulo;
    }

    if (body.tipo !== undefined) {
      if (!VALID_TIPOS.has(body.tipo as GoalTipo)) {
        return Response.json({ error: "Tipo inválido." }, { status: 400 });
      }
      patch.tipo = body.tipo as GoalTipo;
    }

    if (body.meta !== undefined) {
      const meta = Number(body.meta);
      if (!meta || meta <= 0) {
        return Response.json({ error: "Meta inválida." }, { status: 400 });
      }
      patch.meta = meta;
    }

    if (body.atual !== undefined) {
      patch.atual = Number(body.atual);
    }

    if (body.data_inicio !== undefined) patch.data_inicio = body.data_inicio;
    if (body.data_fim !== undefined) patch.data_fim = body.data_fim;

    if (body.status !== undefined) {
      if (!["ativa", "concluida", "cancelada"].includes(body.status)) {
        return Response.json({ error: "Status inválido." }, { status: 400 });
      }
      patch.status = body.status as "ativa" | "concluida" | "cancelada";
    }

    if (patch.data_inicio && patch.data_fim && patch.data_fim < patch.data_inicio) {
      return Response.json({ error: "Datas inválidas." }, { status: 400 });
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
    }

    const { goal, error } = await updateGoal(id, patch);

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      if (status === 401) logAuthFailure("/api/goals/[id]", error);
      else logApiError("metas", "/api/goals/[id]", error, status);
      return Response.json({ error }, { status });
    }

    return Response.json({ goal });
  } catch (error) {
    console.error("[goals] PATCH", error);
    return Response.json({ error: "Erro ao atualizar meta." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { error } = await deleteGoal(id);

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      if (status === 401) logAuthFailure("/api/goals/[id]", error);
      else logApiError("metas", "/api/goals/[id]", error, status);
      return Response.json({ error }, { status });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[goals] DELETE", error);
    return Response.json({ error: "Erro ao excluir meta." }, { status: 500 });
  }
}
