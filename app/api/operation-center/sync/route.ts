import { syncOperationCenterState } from "@/lib/supabase/services/operation-center.service";

export async function POST() {
  const { dashboard, error } = await syncOperationCenterState();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({
    dashboard,
    message: "Operation Center sincronizado.",
  });
}
