import {
  getCreativeFactoryDashboard,
} from "@/lib/supabase/services/creative-factory.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationId = searchParams.get("operationId");

  const { dashboard, assets, storageReady, error } = await getCreativeFactoryDashboard({
    operationId,
  });

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ dashboard, assets, storageReady });
}
