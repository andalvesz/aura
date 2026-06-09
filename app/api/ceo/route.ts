import { deleteCeoSession, getCeoDashboard } from "@/lib/supabase/services/ceo.service";

export async function GET() {
  const { dashboard, session, radar, sessions, error } = await getCeoDashboard();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard, session, radar, sessions });
}

export async function DELETE(request: Request) {
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
}
