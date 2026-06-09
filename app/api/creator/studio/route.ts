import {
  deleteStudioAsset,
  getStudioDashboard,
} from "@/lib/supabase/services/creative-studio.service";

export async function GET() {
  const { dashboard, records, error } = await getStudioDashboard();
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

  const { error } = await deleteStudioAsset(id);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
