import { generateStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import type { StudioGenerateKind, StudioIntake } from "@/utils/creative-studio";

const VALID_KINDS: StudioGenerateKind[] = [
  "criativo",
  "roteiro",
  "carrossel",
  "thumbnail",
  "vsl",
  "social",
  "full",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StudioIntake> & { kind?: string };
    const nome = body.nome?.trim() ?? "";
    const avatar = body.avatar?.trim() ?? "";
    const problema = body.problema?.trim() ?? "";
    const solucao = body.solucao?.trim() ?? "";
    const promessa = body.promessa?.trim() ?? "";
    const diferencial = body.diferencial?.trim() ?? "";
    const preco =
      typeof body.preco === "number" && !Number.isNaN(body.preco) ? body.preco : null;
    const product_id = body.product_id?.trim() || null;
    const copylab_id = body.copylab_id?.trim() || null;
    const asset_id = body.asset_id?.trim() || null;
    const kind = VALID_KINDS.includes(body.kind as StudioGenerateKind)
      ? (body.kind as StudioGenerateKind)
      : "full";

    if (!nome && !problema) {
      return Response.json(
        { error: "Informe o nome ou o problema do produto." },
        { status: 400 }
      );
    }

    const { record, error } = await generateStudioAssets(
      {
        nome,
        avatar,
        problema,
        solucao,
        promessa,
        diferencial,
        preco,
        product_id,
        copylab_id,
        asset_id,
      },
      kind
    );

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ record });
  } catch {
    return Response.json({ error: "Erro ao gerar ativos." }, { status: 500 });
  }
}
