import {
  deleteGlobalMarket,
  getGlobalDashboard,
  syncResultsFromIntegrations,
} from "@/lib/supabase/services/global-intelligence.service";

export async function GET() {
  const { dashboard, markets, strategies, results, error } = await getGlobalDashboard();

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ dashboard, markets, strategies, results });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Informe id." }, { status: 400 });
  }

  const { error } = await deleteGlobalMarket(id);
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
    const { synced, error } = await syncResultsFromIntegrations();
    if (error) {
      return Response.json(
        { error },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }
    return Response.json({ synced });
  }

  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
