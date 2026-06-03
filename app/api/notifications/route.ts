import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  syncNotifications,
} from "@/lib/supabase/services/notifications.service";
import { parseRequestJson } from "@/utils/safe-json";

export async function GET() {
  try {
    const { notifications, error } = await listNotifications();

    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      return Response.json({ error: "Não foi possível carregar notificações." }, { status: 500 });
    }

    const unreadCount = notifications.filter((n) => n.status === "unread").length;

    return Response.json({ notifications, unreadCount });
  } catch (error) {
    console.error("[notifications] GET", error);
    return Response.json({ error: "Erro ao carregar notificações." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { data: body } = await parseRequestJson<{ action?: string }>(req);
    const action = body?.action ?? "sync";

    if (action === "read-all") {
      const { error } = await markAllNotificationsRead();
      if (error === "Usuário não autenticado.") {
        return Response.json({ error }, { status: 401 });
      }
      if (error) {
        return Response.json({ error: "Não foi possível marcar como lidas." }, { status: 500 });
      }
      return Response.json({ ok: true });
    }

    const { created, error } = await syncNotifications();

    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }

    const { notifications, error: listError } = await listNotifications();

    return Response.json({
      created,
      notifications: notifications ?? [],
      unreadCount: (notifications ?? []).filter((n) => n.status === "unread").length,
      error: listError,
    });
  } catch (error) {
    console.error("[notifications] POST", error);
    return Response.json({ error: "Erro ao sincronizar notificações." }, { status: 500 });
  }
}
