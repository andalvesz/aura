import OpenAI from "openai";
import { CreatorLandingsRepository } from "@/lib/supabase/repositories/creator-landings.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { loadStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { loadLaunchPlans } from "@/lib/supabase/services/launch.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type { CreatorLanding, LandingModelo, TableInsert, TableUpdate } from "@/types/database";
import {
  buildLandingAuraContext,
  computeLandingDashboard,
  type GeneratedLanding,
  type LandingDashboardMetrics,
  type LandingGenerateKind,
  type LandingIntake,
} from "@/utils/landing-builder";
import { getOptionalDataContext } from "./context";

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

async function callLandingAi<T>(system: string, user: string): Promise<T | null> {
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

const MODELO_INSTRUCTIONS: Record<LandingModelo, string> = {
  pagina_simples:
    "Modelo PÁGINA SIMPLES: hero impactante, 3-5 benefícios, CTA único, rodapé mínimo. Sem FAQ longo.",
  pagina_longa:
    "Modelo PÁGINA LONGA: todas as seções completas — problema agitado, solução, depoimentos, FAQ extenso, múltiplos CTAs.",
  captura_leads:
    "Modelo CAPTURA DE LEADS: hero com lead magnet, benefícios do material gratuito, formulário implícito no CTA, urgência.",
  webinar:
    "Modelo WEBINAR: convite ao evento, agenda do webinar, o que o participante vai aprender, data/horário no hero, CTA de registro.",
  produto_digital:
    "Modelo PRODUTO DIGITAL: oferta completa, stack de bônus, garantia forte, preço/valor, CTA de compra.",
};

const KIND_INSTRUCTIONS: Record<LandingGenerateKind, string> = {
  generate: "Gere uma landing page nova e completa.",
  improve:
    "Melhore a landing existente: headline mais magnética, benefícios mais claros, copy mais persuasiva, CTA mais forte.",
  optimize:
    "Otimize para conversão: hierarquia visual, prova social, redução de objeções no FAQ, CTAs repetidos estrategicamente.",
};

function buildSystemPrompt(modelo: LandingModelo, kind: LandingGenerateKind): string {
  return `Você é a Aura Landing Builder — especialista em páginas de vendas de alta conversão no Brasil.
${MODELO_INSTRUCTIONS[modelo]}
${KIND_INSTRUCTIONS[kind]}

Responda APENAS JSON:
{
  "hero_section": string,
  "headline": string,
  "subheadline": string,
  "beneficios": string[],
  "section_problema": string,
  "section_solucao": string,
  "depoimentos": [{ "nome": string, "texto": string, "resultado": string }],
  "garantia": string,
  "bonus": string,
  "faq": [{ "pergunta": string, "resposta": string }],
  "cta": string,
  "rodape": string
}
Regras:
- hero_section: descrição visual + copy do hero (layout, cores, elementos)
- headline magnética com promessa clara
- beneficios: bullets de transformação (não features)
- depoimentos: estrutura realista (nome, história, resultado)
- faq: 4-8 perguntas que quebram objeções
- cta: texto do botão + microcopy abaixo
- rodape: links, copyright, disclaimer
- Português do Brasil, persuasivo e autêntico`;
}

async function loadModuleContext(): Promise<{
  creatorSummary: string;
  researchSummary: string;
  copylabSummary: string;
  launchSummary: string;
  studioSummary: string;
}> {
  const [{ bundles }, { records: researchRecords }, { records: copyRecords }, launch, { records: assets }] =
    await Promise.all([
      loadCreatorBundles(),
      loadResearchRecords(),
      loadCopylabRecords(),
      loadLaunchPlans(),
      loadStudioAssets(),
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

  const copylabSummary =
    copyRecords.length > 0
      ? copyRecords
          .slice(0, 3)
          .map(
            (c) =>
              `• ${c.nome ?? c.headline ?? "—"} — headline: ${c.headline?.slice(0, 50) ?? "—"} · bullets: ${Array.isArray(c.bullets) ? (c.bullets as string[]).length : 0}`
          )
          .join("\n")
      : "Nenhuma copy no CopyLab.";

  const launchSummary =
    launch.plans.length > 0
      ? launch.plans
          .slice(0, 3)
          .map((p) => `• ${p.titulo ?? "—"} · estágio ${p.estagio_atual ?? "—"}`)
          .join("\n")
      : "Nenhum plano no Launch Center.";

  const studioSummary =
    assets.length > 0
      ? assets
          .slice(0, 3)
          .map((a) => `• ${a.nome ?? "—"} · criativos FB/IG: ${a.criativo_facebook ? "sim" : "—"}`)
          .join("\n")
      : "Nenhum ativo no Creative Studio.";

  return {
    creatorSummary,
    researchSummary,
    copylabSummary,
    launchSummary,
    studioSummary,
  };
}

export async function loadLandingRecords(): Promise<{
  records: CreatorLanding[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { records: [], error: "Usuário não autenticado." };

  const repo = new CreatorLandingsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { records: [], error };
  return { records: data ?? [], error: null };
}

export async function getLandingDashboard(): Promise<{
  dashboard: LandingDashboardMetrics | null;
  records: CreatorLanding[];
  error: string | null;
}> {
  const { records, error } = await loadLandingRecords();
  if (error) return { dashboard: null, records: [], error };
  return {
    dashboard: computeLandingDashboard(records),
    records,
    error: null,
  };
}

export async function getLandingContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ records }, moduleCtx] = await Promise.all([loadLandingRecords(), loadModuleContext()]);

  const lines = [
    "## AURA LANDING BUILDER",
    buildLandingAuraContext(records),
    `## CREATOR\n${moduleCtx.creatorSummary}`,
    `## RESEARCH\n${moduleCtx.researchSummary}`,
    `## COPYLAB\n${moduleCtx.copylabSummary}`,
    `## CREATIVE STUDIO\n${moduleCtx.studioSummary}`,
    `## LAUNCH CENTER\n${moduleCtx.launchSummary}`,
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: null };
}

export async function generateLanding(
  input: LandingIntake,
  kind: LandingGenerateKind = "generate"
): Promise<{ record: CreatorLanding | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { record: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { record: null, error: "IA indisponível (OPENAI_API_KEY)." };

  if (!input.nome.trim() && !input.problema.trim()) {
    return { record: null, error: "Informe o nome ou o problema do produto." };
  }

  const moduleCtx = await loadModuleContext();
  const repo = new CreatorLandingsRepository(ctx.supabase, ctx.userId);

  let existing: CreatorLanding | null = null;
  if (input.landing_id) {
    const { data } = await repo.findById(input.landing_id);
    existing = data;
  } else if (input.product_id && kind !== "generate") {
    const { data } = await repo.findByProductId(input.product_id);
    existing = data;
  }

  const modelo = input.modelo ?? existing?.modelo ?? "pagina_simples";

  const generated = await callLandingAi<GeneratedLanding>(
    buildSystemPrompt(modelo, kind),
    JSON.stringify({
      intake: input,
      modelo,
      kind,
      existingLanding: existing
        ? {
            headline: existing.headline,
            subheadline: existing.subheadline,
            beneficios: existing.beneficios,
            section_problema: existing.section_problema,
            cta: existing.cta,
          }
        : null,
      creatorContext: moduleCtx.creatorSummary,
      researchContext: moduleCtx.researchSummary,
      copylabContext: moduleCtx.copylabSummary,
      studioContext: moduleCtx.studioSummary,
      launchContext: moduleCtx.launchSummary,
    })
  );

  if (!generated?.headline) {
    return { record: null, error: "Não foi possível gerar a landing page." };
  }

  const payload: TableUpdate<"creator_landings"> = {
    modelo,
    nome: input.nome || null,
    avatar: input.avatar || null,
    problema: input.problema || null,
    solucao: input.solucao || null,
    promessa: input.promessa || null,
    diferencial: input.diferencial || null,
    preco: input.preco,
    product_id: input.product_id ?? null,
    copylab_id: input.copylab_id ?? null,
    hero_section: generated.hero_section,
    headline: generated.headline,
    subheadline: generated.subheadline,
    beneficios: generated.beneficios,
    section_problema: generated.section_problema,
    section_solucao: generated.section_solucao,
    depoimentos: generated.depoimentos,
    garantia: generated.garantia,
    bonus: generated.bonus,
    faq: generated.faq,
    cta: generated.cta,
    rodape: generated.rodape,
  };

  if (existing && (kind === "improve" || kind === "optimize")) {
    const { data: updated, error: updateError } = await repo.update(existing.id, payload);
    if (updateError || !updated) {
      return { record: null, error: updateError ?? "Erro ao atualizar landing." };
    }
    return { record: updated as CreatorLanding, error: null };
  }

  const { data: record, error: createError } = await repo.create(
    payload satisfies Omit<TableInsert<"creator_landings">, "user_id">
  );

  if (createError || !record) {
    return { record: null, error: createError ?? "Erro ao salvar landing." };
  }

  return { record: record as CreatorLanding, error: null };
}

export async function deleteLandingRecord(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new CreatorLandingsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
