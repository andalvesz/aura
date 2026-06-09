import {
  deleteExecutionPlan,
  getExecutionDashboard,
} from "@/lib/supabase/services/execution.service";

export async function GET() {
  const { dashboard, plan, tasks, briefing, history, error } = await getExecutionDashboard();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard, plan, tasks, briefing, history });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id é obrigatório." }, { status: 400 });
  }

  const { error } = await deleteExecutionPlan(id);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
