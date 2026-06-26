import {
  deleteSmartLaunchSession,
  getSmartLaunchDashboard,
} from "@/lib/supabase/services/smart-launch.service";
import { jsonRouteError } from "@/utils/api-json-route";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id")?.trim() || undefined;

    const { dashboard, center, sessions, error } = await getSmartLaunchDashboard(sessionId);
    if (error) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
    }

    return Response.json({ dashboard, center, sessions });
  } catch (error) {
    return jsonRouteError("smart-launch", error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const { error } = await deleteSmartLaunchSession(id);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return jsonRouteError("smart-launch", error);
  }
}
