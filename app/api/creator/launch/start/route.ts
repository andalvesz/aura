import { startLaunch } from "@/lib/supabase/services/launch.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { productId?: string };
    const productId = body.productId?.trim() || undefined;

    const { plan, center, error } = await startLaunch(productId);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ plan, center });
  } catch {
    return Response.json({ error: "Erro ao iniciar lançamento." }, { status: 500 });
  }
}
