import { getMissionControlState } from "@/lib/supabase/services/mission-control.service";

export async function GET() {
  const { dashboard, tasks, briefing, error } = await getMissionControlState();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard, tasks, briefing });
}
