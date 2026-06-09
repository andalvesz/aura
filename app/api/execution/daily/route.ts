import { generateDailyPlan } from "@/lib/supabase/services/execution.service";

export async function POST() {
  try {
    const { plan, tasks, briefing, error } = await generateDailyPlan();
    if (error) {
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ plan, tasks, briefing });
  } catch {
    return Response.json({ error: "Erro ao gerar plano diário." }, { status: 500 });
  }
}
