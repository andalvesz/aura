import {
  analyzeMarketOpportunity,
  createProductFromResearch,
  deleteResearchRecord,
  getResearchDashboard,
} from "@/lib/supabase/services/research.service";

export async function GET() {
  const { dashboard, records, error } = await getResearchDashboard();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard, records });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id é obrigatório." }, { status: 400 });
  }

  const { error } = await deleteResearchRecord(id);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
