import { completeExecutionTask } from "@/lib/supabase/services/execution.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { taskId?: string };
    const taskId = body.taskId?.trim();

    if (!taskId) {
      return Response.json({ error: "taskId é obrigatório." }, { status: 400 });
    }

    const { task, xpAwarded, planComplete, error } = await completeExecutionTask(taskId);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ task, xpAwarded, planComplete });
  } catch {
    return Response.json({ error: "Erro ao concluir tarefa." }, { status: 500 });
  }
}
