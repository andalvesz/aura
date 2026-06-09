import { generateCopylab } from "@/lib/supabase/services/copylab.service";
import type { CopylabIntake } from "@/utils/copylab";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CopylabIntake>;
    const nome = body.nome?.trim() ?? "";
    const avatar = body.avatar?.trim() ?? "";
    const problema = body.problema?.trim() ?? "";
    const solucao = body.solucao?.trim() ?? "";
    const promessa = body.promessa?.trim() ?? "";
    const diferencial = body.diferencial?.trim() ?? "";
    const preco =
      typeof body.preco === "number" && !Number.isNaN(body.preco) ? body.preco : null;
    const product_id = body.product_id?.trim() || null;

    if (!nome && !problema) {
      return Response.json(
        { error: "Informe o nome ou o problema do produto." },
        { status: 400 }
      );
    }

    const { record, error } = await generateCopylab({
      nome,
      avatar,
      problema,
      solucao,
      promessa,
      diferencial,
      preco,
      product_id,
    });

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ record });
  } catch {
    return Response.json({ error: "Erro ao gerar copy." }, { status: 500 });
  }
}
