import { jsonServerError } from "@/lib/api/json-error";
import { deleteCeoSession, getCeoDashboard } from "@/lib/supabase/services/ceo.service";

export async function GET() {
  try {
    const { dashboard, session, radar, sessions, error } = await getCeoDashboard();
    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }
    return Response.json({
      dashboard,
      session,
      radar,
      sessions: sessions ?? [],
    });
  } catch (error) {
    console.error("[api/ceo] GET failed:", error);
    return jsonServerError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id é obrigatório." }, { status: 400 });
    }

    const { error } = await deleteCeoSession(id);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/ceo] DELETE failed:", error);
    return jsonServerError(error);
  }
}
