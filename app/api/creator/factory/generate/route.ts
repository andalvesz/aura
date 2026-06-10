import { generateProductFactory } from "@/lib/supabase/services/product-factory.service";
import type { ProductFactoryIntake } from "@/utils/product-factory";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ProductFactoryIntake>;
    const titulo = body.titulo?.trim() ?? "";
    const promessa = body.promessa?.trim() ?? "";
    const avatar = body.avatar?.trim() ?? "";
    const problema = body.problema?.trim() ?? "";
    const solucao = body.solucao?.trim() ?? "";
    const product_id = body.product_id?.trim() || null;
    const copylab_id = body.copylab_id?.trim() || null;
    const research_id = body.research_id?.trim() || null;

    if (!titulo && !problema) {
      return Response.json(
        { error: "Informe o título ou o problema do produto." },
        { status: 400 }
      );
    }

    const { bundle, error } = await generateProductFactory({
      titulo,
      promessa,
      avatar,
      problema,
      solucao,
      product_id,
      copylab_id,
      research_id,
    });

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ bundle });
  } catch {
    return Response.json({ error: "Erro ao gerar e-book." }, { status: 500 });
  }
}
