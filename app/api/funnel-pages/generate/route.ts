import { generateFunnelPages } from "@/lib/supabase/services/funnel-pages.service";
import type { FunnelPagesIntake } from "@/utils/funnel-pages";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<FunnelPagesIntake>;
    const funnelId = body.funnel_id?.trim();

    if (!funnelId) {
      return Response.json({ error: "Informe funnel_id." }, { status: 400 });
    }

    const { bundle, error } = await generateFunnelPages({
      funnel_id: funnelId,
      product_id: body.product_id?.trim() || null,
      operation_id: body.operation_id?.trim() || null,
      copylab_id: body.copylab_id?.trim() || null,
      include_quiz: body.include_quiz,
      include_webinar: body.include_webinar,
    });

    if (error || !bundle) {
      return Response.json({ error, bundle }, { status: 400 });
    }

    return Response.json({ bundle });
  } catch {
    return Response.json({ error: "Erro ao gerar páginas do funil." }, { status: 500 });
  }
}
