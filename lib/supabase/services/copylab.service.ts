import OpenAI from "openai";
import { FinancialGoalsRepository } from "@/lib/supabase/repositories/financial-goals.repository";
import { CreatorCopylabRepository } from "@/lib/supabase/repositories/copylab.repository";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type { CreatorCopylab, TableInsert } from "@/types/database";
import {
  buildCopylabAuraContext,
  computeCopylabDashboard,
  type CopylabDashboardMetrics,
  type CopylabIntake,
  type GeneratedCopylab,
} from "@/utils/copylab";
import { getOptionalDataContext } from "./context";

async function getFinanceContext(): Promise<string> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return "";

  const goalsRepo = new FinancialGoalsRepository(ctx.supabase, ctx.userId);
  const { data: goals } = await goalsRepo.findAll("data_fim");
  if (!goals?.length) return "Nenhuma meta financeira cadastrada.";

  return goals
    .slice(0, 5)
    .map(
      (g) =>
        `• ${g.titulo}: meta ${g.valor_meta} · atual ${g.valor_atual} (${g.data_inicio} → ${g.data_fim})`
    )
    .join("\n");
}

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function callCopylabAi<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.75,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

export async function loadCopylabRecords(): Promise<{
  records: CreatorCopylab[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { records: [], error: "Usuário não autenticado." };

  const repo = new CreatorCopylabRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { records: [], error };
  return { records: data ?? [], error: null };
}

export async function getCopylabDashboard(): Promise<{
  dashboard: CopylabDashboardMetrics | null;
  records: CreatorCopylab[];
  error: string | null;
}> {
  const { records, error } = await loadCopylabRecords();
  if (error) return { dashboard: null, records: [], error };
  return {
    dashboard: computeCopylabDashboard(records),
    records,
    error: null,
  };
}

export async function getCopylabContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ records }, { bundles }, legacy, financeContext, { records: researchRecords }] =
    await Promise.all([
      loadCopylabRecords(),
      loadCreatorBundles(),
      getLegacyContext(),
      getFinanceContext(),
      loadResearchRecords(),
    ]);

  const creatorSummary =
    bundles.length > 0
      ? bundles
          .slice(0, 4)
          .map(
            (b) =>
              `• ${b.product.nome ?? "Produto"} — ${b.product.problema?.slice(0, 60) ?? "sem problema"}`
          )
          .join("\n")
      : "Nenhum produto no Creator.";

  const researchSummary =
    researchRecords.length > 0
      ? researchRecords
          .slice(0, 3)
          .map((r) => `• ${r.nicho ?? r.ideia_input ?? "—"} · nota ${r.nota_final ?? "—"}`)
          .join("\n")
      : "Nenhuma pesquisa de mercado.";

  const lines = [
    "## AURA COPYLAB",
    buildCopylabAuraContext(records),
    `## CREATOR\n${creatorSummary}`,
    `## RESEARCH\n${researchSummary}`,
    legacy.context ? `## LEGADO\n${legacy.context}` : "",
    financeContext ? `## FINANCEIRO\n${financeContext}` : "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: legacy.error };
}

export async function generateCopylab(input: CopylabIntake): Promise<{
  record: CreatorCopylab | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { record: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { record: null, error: "IA indisponível (OPENAI_API_KEY)." };

  if (!input.nome.trim() && !input.problema.trim()) {
    return { record: null, error: "Informe o nome ou o problema do produto." };
  }

  const [legacy, financeContext, { records: researchRecords }] = await Promise.all([
    getLegacyContext(),
    getFinanceContext(),
    loadResearchRecords(),
  ]);

  const generated = await callCopylabAi<GeneratedCopylab>(
    `Você é a Aura CopyLab — copywriter de elite para produtos digitais no Brasil.
Gere toda a comunicação de vendas com base nos dados do produto.
Responda APENAS JSON:
{
  "headline": string,
  "subheadline": string,
  "big_idea": string,
  "mecanismo_unico": string,
  "bullets": string[],
  "garantia": string,
  "bonus": string,
  "cta": string,
  "pagina_vendas": string,
  "estrutura_vsl": string,
  "storytelling": string,
  "email_lancamento": string,
  "whatsapp_venda": string,
  "instagram_post": string,
  "facebook_ad": string,
  "google_ad": string
}
Regras:
- Headline magnética com promessa clara
- Bullets com benefícios + prova
- pagina_vendas: estrutura completa em markdown (seções: hero, problema, solução, oferta, garantia, CTA)
- estrutura_vsl: roteiro com ganchos, história, prova, oferta, fechamento
- storytelling: narrativa emocional do avatar
- email_lancamento, whatsapp_venda: textos prontos para enviar
- instagram_post, facebook_ad, google_ad: criativos com headline + corpo + CTA
- Português do Brasil, tom persuasivo e autêntico`,
    JSON.stringify({
      intake: input,
      legacyContext: legacy.context ?? null,
      financeContext: financeContext ?? null,
      researchContext: researchRecords.slice(0, 2).map((r) => ({
        nicho: r.nicho,
        avatar: r.avatar,
        problema: r.problema,
        diferencial: r.diferencial_sugerido,
      })),
    })
  );

  if (!generated?.headline) {
    return { record: null, error: "Não foi possível gerar a copy." };
  }

  const repo = new CreatorCopylabRepository(ctx.supabase, ctx.userId);
  const { data: record, error: createError } = await repo.create({
    product_id: input.product_id ?? null,
    nome: input.nome || null,
    avatar: input.avatar || null,
    problema: input.problema || null,
    solucao: input.solucao || null,
    promessa: input.promessa || null,
    diferencial: input.diferencial || null,
    preco: input.preco,
    headline: generated.headline,
    subheadline: generated.subheadline,
    big_idea: generated.big_idea,
    mecanismo_unico: generated.mecanismo_unico,
    bullets: generated.bullets,
    garantia: generated.garantia,
    bonus: generated.bonus,
    cta: generated.cta,
    pagina_vendas: generated.pagina_vendas,
    estrutura_vsl: generated.estrutura_vsl,
    storytelling: generated.storytelling,
    email_lancamento: generated.email_lancamento,
    whatsapp_venda: generated.whatsapp_venda,
    instagram_post: generated.instagram_post,
    facebook_ad: generated.facebook_ad,
    google_ad: generated.google_ad,
  } satisfies Omit<TableInsert<"creator_copylab">, "user_id">);

  if (createError || !record) {
    return { record: null, error: createError ?? "Erro ao salvar copy." };
  }

  return { record: record as CreatorCopylab, error: null };
}

export async function deleteCopylabRecord(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new CreatorCopylabRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
