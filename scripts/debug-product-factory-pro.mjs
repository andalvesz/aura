/**
 * Debug Product Factory Pro — simula Gerar → Melhorar Produto
 * Uso: node --import tsx scripts/debug-product-factory-pro.mjs [factory_id] [user_id]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import {
  buildProActionPrompt,
  buildProGenerationSystemPrompt,
  computeProductQualityScore,
  detectSensitiveNiche,
  parseProContent,
} from "../utils/product-factory-pro.ts";
import { applyWinnerPatternToSystemPrompt } from "../utils/winner-pattern.ts";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    console.warn("[debug-product-pro] .env.local not found");
  }
}

function parseJsonBlock(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

const MOCK_FACTORY = {
  id: "debug-factory",
  user_id: "debug-user",
  product_id: null,
  copylab_id: null,
  research_id: null,
  product_type: "ebook",
  titulo: "Guia Prático de Emagrecimento Saudável",
  subtitulo: "Hábitos sustentáveis para resultados reais",
  promessa: "Percorra um plano de 30 dias com hábitos simples e sustentáveis",
  avatar: "Adultos que querem emagrecer com saúde",
  publico: "Brasil, 25-45 anos",
  objetivo: "Emagrecer de forma sustentável",
  problema: "Dificuldade em manter dieta e rotina",
  solucao: "Sistema de hábitos progressivos",
  capitulos: [
    {
      titulo: "Fundamentos",
      resumo: "Base do método",
      conteudo: "word ".repeat(200),
    },
    {
      titulo: "Plano de 30 dias",
      resumo: "Rotina diária",
      conteudo: "word ".repeat(200),
    },
  ],
  exercicios: [{ titulo: "Diário alimentar", instrucao: "Registre", reflexao: "O que aprendi" }],
  checklist: [{ item: "Água", descricao: "Beber 2L por dia" }],
  bonus: "Checklist de compras",
  conclusao: "Comece hoje mesmo",
  design: {
    template_id: "fitness_modern",
    capa: "Capa moderna",
    paleta: ["#0F766E", "#134E4A", "#F97316", "#ECFDF5"],
    estilo_visual: "fitness",
    paginas_internas: "clean",
    mockup_textual: "",
    tipografia: "",
    moodboard: "",
  },
  conteudo: {
    introducao: "intro ".repeat(80),
    metodologia: "method ".repeat(60),
    pro_version: true,
    faqs: [],
  },
  status: "design_ready",
  current_version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

async function testOpenAiImprove(factory) {
  const model = "gpt-4o-mini";
  const action = "improve";
  const nicheText = `${factory.titulo} ${factory.promessa} ${factory.problema} ${factory.publico ?? ""}`;
  const sensitive =
    detectSensitiveNiche(nicheText) || !!parseProContent(factory.conteudo).sensitive_niche;

  const system = applyWinnerPatternToSystemPrompt(
    buildProGenerationSystemPrompt(factory.product_type ?? "ebook", sensitive),
    "",
    "product-factory"
  );
  const user = `${buildProActionPrompt(action, factory)}\n${JSON.stringify({ winnerContext: {} })}`;

  const scoreBefore = computeProductQualityScore(factory, null).score;

  const report = {
    phase: "openai-improve",
    request: {
      model,
      action,
      factoryId: factory.id,
      scoreBefore,
      systemChars: system.length,
      userChars: user.length,
      sensitive,
    },
    response: null,
    parse: null,
    scoreAfter: null,
    error: null,
    stack: null,
  };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    report.error = "OPENAI_API_KEY ausente";
    return report;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content ?? "";
    report.response = {
      finishReason: response.choices[0]?.finish_reason,
      contentChars: content.length,
      contentPreview: content.slice(0, 400),
    };

    const parsed = parseJsonBlock(content);
    report.parse = {
      ok: !!parsed,
      hasTitulo: !!parsed?.titulo,
      capitulosCount: parsed?.capitulos?.length ?? 0,
      keys: parsed ? Object.keys(parsed) : [],
    };

    if (parsed?.titulo && parsed?.capitulos?.length) {
      const merged = {
        ...factory,
        ...parsed,
        capitulos: parsed.capitulos,
        conteudo: { ...(factory.conteudo ?? {}), ...(parsed.conteudo ?? {}) },
      };
      report.scoreAfter = computeProductQualityScore(merged, null).score;
    } else {
      report.error = "Payload IA inválido: titulo ou capitulos ausentes";
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.stack = error instanceof Error ? error.stack : undefined;
  }

  return report;
}

async function testSupabaseFactory(factoryId, userId) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    return { error: "Supabase env ausente", factory: null };
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("product_factory")
    .select("*")
    .eq("id", factoryId)
    .eq("user_id", userId)
    .maybeSingle();

  return { error: error?.message ?? null, factory: data };
}

async function main() {
  loadEnvLocal();

  const factoryId = process.argv[2]?.trim();
  const userId = process.argv[3]?.trim();

  const report = {
    timestamp: new Date().toISOString(),
    env: {
      openai: !!process.env.OPENAI_API_KEY?.trim(),
      supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    },
    phases: [],
    rootCause: null,
    recommendation: null,
  };

  let factory = MOCK_FACTORY;

  if (factoryId && userId) {
    const db = await testSupabaseFactory(factoryId, userId);
    report.phases.push({ phase: "supabase-load", factoryId, userId, ...db });
    if (db.factory) factory = db.factory;
    else if (db.error) {
      report.rootCause = `Supabase RLS/auth: ${db.error}`;
    }
  }

  const openaiReport = await testOpenAiImprove(factory);
  report.phases.push(openaiReport);

  if (openaiReport.error) {
    report.rootCause = openaiReport.error;
    report.recommendation = "Verificar OPENAI_API_KEY, quota, ou resposta JSON da IA.";
  } else if (!openaiReport.parse?.ok) {
    report.rootCause = "Falha ao parsear JSON da OpenAI";
    report.recommendation = "IA retornou conteúdo não-JSON ou JSON incompleto.";
  } else if (!openaiReport.parse.hasTitulo || openaiReport.parse.capitulosCount === 0) {
    report.rootCause = "OpenAI retornou JSON sem titulo/capitulos";
    report.recommendation = "Ajustar prompt ou schema Pro V1.";
  } else {
    report.rootCause = "OpenAI path OK em isolamento — erro provável em auth, DB update ou exceção não tratada no servidor.";
    report.recommendation =
      "Rodar dev server, clicar Melhorar Produto e inspecionar logs [product-pro] no terminal.";
  }

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.rootCause?.includes("OK") ? 0 : 1;
}

main().catch((error) => {
  console.error("[debug-product-pro] fatal", error);
  process.exitCode = 1;
});
