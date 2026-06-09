import { generateAdsCampaign } from "@/lib/supabase/services/ads-manager.service";
import type { AdsIntake } from "@/utils/ads-manager";
import type { AdsObjetivo, AdsOrcamentoNivel } from "@/types/database";

const VALID_OBJETIVOS: AdsObjetivo[] = ["conversao", "leads", "trafego", "engajamento"];
const VALID_ORCAMENTOS: AdsOrcamentoNivel[] = ["baixo", "medio", "escala"];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AdsIntake>;
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
    const landing_id = body.landing_id?.trim() || null;
    const campaign_id = body.campaign_id?.trim() || null;
    const objetivo = VALID_OBJETIVOS.includes(body.objetivo as AdsObjetivo)
      ? (body.objetivo as AdsObjetivo)
      : null;
    const orcamento_nivel = VALID_ORCAMENTOS.includes(body.orcamento_nivel as AdsOrcamentoNivel)
      ? (body.orcamento_nivel as AdsOrcamentoNivel)
      : null;

    if (!nome && !problema) {
      return Response.json(
        { error: "Informe o nome ou o problema do produto." },
        { status: 400 }
      );
    }

    const { record, error } = await generateAdsCampaign({
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
      landing_id,
      campaign_id,
      objetivo,
      orcamento_nivel,
    });

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ record });
  } catch {
    return Response.json({ error: "Erro ao gerar campanha." }, { status: 500 });
  }
}
