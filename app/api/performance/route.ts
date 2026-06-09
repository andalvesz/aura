import {
  deletePerformanceReport,
  getPerformanceDashboard,
} from "@/lib/supabase/services/performance.service";

export async function GET() {
  const {
    dashboard,
    report,
    metrics,
    insights,
    panel,
    analysis,
    executiveMemory,
    error,
  } = await getPerformanceDashboard();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({
    dashboard,
    report,
    metrics,
    insights,
    panel,
    analysis,
    executiveMemory,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id é obrigatório." }, { status: 400 });
  }

  const { error } = await deletePerformanceReport(id);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
