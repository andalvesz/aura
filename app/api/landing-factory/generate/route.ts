import { generateLandingPage } from "@/lib/supabase/services/landing-factory.service";
import { linkLandingFactoryToOperation } from "@/lib/supabase/services/operation-center.service";
import type { LandingFactoryIntake } from "@/utils/landing-factory";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LandingFactoryIntake>;
    const operationId = body.operation_id?.trim() || null;

    const { page, message, error } = await generateLandingPage({
      operation_id: operationId,
      product_id: body.product_id?.trim() || null,
      copylab_id: body.copylab_id?.trim() || null,
      titulo: body.titulo?.trim(),
      promessa: body.promessa?.trim(),
      avatar: body.avatar?.trim(),
      problema: body.problema?.trim(),
      solucao: body.solucao?.trim(),
      headline: body.headline?.trim(),
    });

    if (error || !page) {
      return Response.json({ error, page }, { status: 400 });
    }

    let operation = null;
    if (operationId) {
      const sync = await linkLandingFactoryToOperation(operationId, {
        id: page.id,
        title: page.title,
        slug: page.slug,
      });
      operation = sync.operation;
    }

    return Response.json({ page, operation, message });
  } catch {
    return Response.json({ error: "Erro ao gerar landing page." }, { status: 500 });
  }
}
