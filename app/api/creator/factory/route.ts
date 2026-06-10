import {
  deleteProductFactoryRecord,
  getProductFactoryDashboard,
} from "@/lib/supabase/services/product-factory.service";

export async function GET() {
  const { dashboard, bundles, storageReady, error } = await getProductFactoryDashboard();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard, bundles, storageReady });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id é obrigatório." }, { status: 400 });
  }

  const { error } = await deleteProductFactoryRecord(id);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
