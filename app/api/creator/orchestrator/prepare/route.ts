import { prepareLaunch } from "@/lib/supabase/services/campaign-orchestrator.service";
import type { OrchestratorIntake } from "@/utils/campaign-orchestrator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrchestratorIntake;
    const productId = body.product_id?.trim();

    if (!productId) {
      return Response.json({ error: "product_id é obrigatório." }, { status: 400 });
    }

    const { orchestration, center, error } = await prepareLaunch({
      product_id: productId,
      orchestration_id: body.orchestration_id ?? null,
    });

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ orchestration, center });
  } catch {
    return Response.json({ error: "Erro ao preparar lançamento." }, { status: 500 });
  }
}
