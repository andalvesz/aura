import { generateLanding } from "@/lib/supabase/services/landing-builder.service";
import type { LandingGenerateKind, LandingIntake } from "@/utils/landing-builder";
import type { LandingModelo } from "@/types/database";

const VALID_KINDS: LandingGenerateKind[] = ["generate", "improve", "optimize"];
const VALID_MODELOS: LandingModelo[] = [
  "pagina_simples",
  "pagina_longa",
  "captura_leads",
  "webinar",
  "produto_digital",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LandingIntake> & {
      kind?: string;
    };
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
    const landing_id = body.landing_id?.trim() || null;
    const modelo = VALID_MODELOS.includes(body.modelo as LandingModelo)
      ? (body.modelo as LandingModelo)
      : "pagina_simples";
    const kind = VALID_KINDS.includes(body.kind as LandingGenerateKind)
      ? (body.kind as LandingGenerateKind)
      : "generate";

    if (!nome && !problema && kind === "generate") {
      return Response.json(
        { error: "Informe o nome ou o problema do produto." },
        { status: 400 }
      );
    }

    const { record, error } = await generateLanding(
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
        landing_id,
        modelo,
      },
      kind
    );

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ record });
  } catch {
    return Response.json({ error: "Erro ao gerar landing." }, { status: 500 });
  }
}
