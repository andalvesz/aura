import {
  deleteSmartLaunchSession,
  getSmartLaunchDashboard,
  prepareSmartLaunch,
} from "@/lib/supabase/services/smart-launch.service";
import type { SmartLaunchIntake } from "@/utils/smart-launch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id")?.trim() || undefined;

  const { dashboard, center, sessions, error } = await getSmartLaunchDashboard(sessionId);
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ dashboard, center, sessions });
}

export async function DELETE(request: Request) {
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
}
