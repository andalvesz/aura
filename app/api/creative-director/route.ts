import { getCreativeDirectorRealDashboard } from "@/lib/supabase/services/creative-generated-assets.service";

export async function GET() {
  try {
    const { dashboard, assets, storageReady, error } = await getCreativeDirectorRealDashboard();

    if (error) {
      return Response.json({ error, dashboard, assets, storageReady }, { status: 400 });
    }

    return Response.json({ dashboard, assets, storageReady });
  } catch {
    return Response.json({ error: "Erro ao carregar Creative Director." }, { status: 500 });
  }
}
