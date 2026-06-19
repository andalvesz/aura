import { getExpertContextForApi } from "@/lib/supabase/services/expert-brain.service";
import { EXPERT_BRAIN_CATEGORIES } from "@/utils/expert-brain";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const task = searchParams.get("task")?.trim() ?? "copywriting";

    if (!EXPERT_BRAIN_CATEGORIES.includes(task as (typeof EXPERT_BRAIN_CATEGORIES)[number])) {
      return Response.json({ error: "task inválida." }, { status: 400 });
    }

    const {
      frameworks,
      playbooks,
      patterns,
      decisionRules,
      checklists,
      failurePatterns,
      successPatterns,
      error,
    } = await getExpertContextForApi(task);

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error }, { status });
    }

    return Response.json({
      task,
      frameworks,
      playbooks,
      patterns,
      decisionRules,
      checklists,
      failurePatterns,
      successPatterns,
    });
  } catch {
    return Response.json({ error: "Erro ao carregar contexto expert." }, { status: 500 });
  }
}
