import {
  deleteCreatorProduct,
  getCreatorDashboard,
} from "@/lib/supabase/services/creator.service";
import { logApiError, logAuthFailure } from "@/lib/logs/record";

export async function GET() {
  try {
    const { dashboard, bundles, error } = await getCreatorDashboard();

    if (error === "Usuário não autenticado.") {
      logAuthFailure("/api/creator", error);
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      logApiError("creator", "/api/creator", error, 500);
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ dashboard, bundles });
  } catch (error) {
    console.error("[creator] GET", error);
    logApiError("creator", "/api/creator", error, 500);
    return Response.json({ error: "Erro ao carregar Creator." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return Response.json({ error: "ID do produto obrigatório." }, { status: 400 });
    }

    const { error } = await deleteCreatorProduct(id);

    if (error === "Usuário não autenticado.") {
      logAuthFailure("/api/creator", error);
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      logApiError("creator", "/api/creator", error, 500);
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[creator] DELETE", error);
    logApiError("creator", "/api/creator", error, 500);
    return Response.json({ error: "Erro ao excluir produto." }, { status: 500 });
  }
}
