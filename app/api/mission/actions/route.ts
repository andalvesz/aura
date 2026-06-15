import { runMissionAction } from "@/lib/supabase/services/mission-control.service";
import type { MissionActionId } from "@/utils/mission-control";
import { MISSION_ACTIONS } from "@/utils/mission-control";

const VALID_ACTIONS = new Set<string>(MISSION_ACTIONS.map((a) => a.id));

export async function POST(request: Request) {
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const action = body.action?.trim();
  if (!action || !VALID_ACTIONS.has(action)) {
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  }

  const { message, error } = await runMissionAction(action as MissionActionId);
  if (error && !message) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 400 }
    );
  }

  return Response.json({ message, error: error ?? null });
}
