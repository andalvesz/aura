import {
  completeMoneyMissionTask,
  deleteMoneyPlan,
  getMoneyDashboard,
  startMoneyMission,
  updateMoneyProgress,
} from "@/lib/supabase/services/money.service";
import type { MoneyPrazo, MoneyPrioridade } from "@/utils/money";

export async function GET() {
  const { dashboard, plan, tasks, error } = await getMoneyDashboard();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard, plan, tasks });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id é obrigatório." }, { status: 400 });
  }

  const { error } = await deleteMoneyPlan(id);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      taskId?: string;
      valorConquistado?: number;
    };

    if (body.action === "complete" && body.taskId) {
      const { task, error } = await completeMoneyMissionTask(body.taskId);
      if (error) {
        return Response.json({ error }, { status: 400 });
      }
      return Response.json({ task });
    }

    if (body.action === "progress" && typeof body.valorConquistado === "number") {
      const { plan, error } = await updateMoneyProgress(body.valorConquistado);
      if (error) {
        return Response.json({ error }, { status: 400 });
      }
      return Response.json({ plan });
    }

    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch {
    return Response.json({ error: "Erro ao processar requisição." }, { status: 500 });
  }
}
