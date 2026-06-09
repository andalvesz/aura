import {
  deleteOrchestration,
  getOrchestratorDashboard,
} from "@/lib/supabase/services/campaign-orchestrator.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id")?.trim() || undefined;

  const { dashboard, center, records, bundles, error } = await getOrchestratorDashboard(productId);
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard, center, records, bundles: bundles.map((b) => ({ id: b.product.id, nome: b.product.nome })) });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id é obrigatório." }, { status: 400 });
  }

  const { error } = await deleteOrchestration(id);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
