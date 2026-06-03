import {
  deleteNotification,
  markNotificationRead,
} from "@/lib/supabase/services/notifications.service";
import { parseRequestJson } from "@/utils/safe-json";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { data: body } = await parseRequestJson<{ action?: string }>(req);

    if (body?.action !== "read") {
      return Response.json({ error: "Ação inválida." }, { status: 400 });
    }

    const { notification, error } = await markNotificationRead(id);

    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }

    if (error || !notification) {
      return Response.json(
        { error: error ?? "Notificação não encontrada." },
        { status: 404 }
      );
    }

    return Response.json({ notification });
  } catch (error) {
    console.error("[notifications] PATCH", error);
    return Response.json({ error: "Erro ao atualizar notificação." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { error } = await deleteNotification(id);

    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      return Response.json({ error: "Não foi possível excluir a notificação." }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[notifications] DELETE", error);
    return Response.json({ error: "Erro ao excluir notificação." }, { status: 500 });
  }
}
