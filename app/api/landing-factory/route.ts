import { getLandingFactoryDashboard } from "@/lib/supabase/services/landing-factory.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const operationId = searchParams.get("operationId");

  const { dashboard, pages, error } = await getLandingFactoryDashboard({
    operationId,
  });

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ dashboard, pages });
}
