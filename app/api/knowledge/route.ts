import {
  deleteKnowledgeEntry,
  dismissKnowledgeInsight,
  generateKnowledgeInsights,
  getKnowledgeDashboard,
  syncKnowledgeFromIntegrations,
} from "@/lib/supabase/services/knowledge.service";

export async function GET() {
  const { dashboard, entries, insights, patterns, marketHistory, connectors, error } =
    await getKnowledgeDashboard();

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({
    dashboard,
    entries,
    insights,
    patterns,
    marketHistory,
    connectors,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type");

  if (!id) {
    return Response.json({ error: "Informe id." }, { status: 400 });
  }

  if (type === "insight") {
    const { error } = await dismissKnowledgeInsight(id);
    if (error) {
      return Response.json(
        { error },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }
    return Response.json({ ok: true });
  }

  const { error } = await deleteKnowledgeEntry(id);
  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "sync") {
    const { synced, error } = await syncKnowledgeFromIntegrations();
    if (error) {
      return Response.json(
        { error },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }
    return Response.json({ synced });
  }

  if (action === "insights") {
    const { insights, error } = await generateKnowledgeInsights();
    if (error) {
      return Response.json(
        { error },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }
    return Response.json({ insights, count: insights.length });
  }

  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
