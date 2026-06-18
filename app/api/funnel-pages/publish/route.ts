import { publishFunnel } from "@/lib/supabase/services/funnel-publish.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { funnel_id?: string };
    const funnelId = body.funnel_id?.trim();

    if (!funnelId) {
      return Response.json({ error: "Informe funnel_id." }, { status: 400 });
    }

    const { result, error } = await publishFunnel(funnelId);

    if (error && !result) {
      return Response.json({ error, result }, { status: 400 });
    }

    return Response.json({ result, error });
  } catch {
    return Response.json({ error: "Erro ao publicar funil." }, { status: 500 });
  }
}
