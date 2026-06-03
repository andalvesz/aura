import OpenAI, { APIError } from "openai";
import {
  FinancialGoalsRepository,
  FinancialIncomeRepository,
} from "@/lib/supabase/repositories";
import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import { loadAuraGlobalSummaryData } from "@/lib/supabase/services/mentor.service";
import type { AlveszEvento, FinancialGoal, FinancialIncome } from "@/types/database";
import {
  buildExecutiveReport,
  buildReportAnalysisFallback,
  type ExecutiveReportAnalysis,
  type ExecutiveReportData,
  type ExecutiveReportPayload,
  type ExecutiveReportType,
} from "@/utils/executive-reports";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function loadExecutiveReportData(): Promise<{
  data: ExecutiveReportData | null;
  error: string | null;
}> {
  const { data: base, error } = await loadAuraGlobalSummaryData();
  if (error || !base) {
    return { data: null, error };
  }

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { data: null, error: "Usuário não autenticado." };
  }

  let financialIncome: FinancialIncome[] = [];
  let financialGoals: FinancialGoal[] = [];
  let alveszEventos: AlveszEvento[] = [];

  try {
    const [incomeRes, goalsRes, eventosRes] = await Promise.all([
      new FinancialIncomeRepository(ctx.supabase, ctx.userId).findAll("data"),
      new FinancialGoalsRepository(ctx.supabase, ctx.userId).findAll("data_fim"),
      new BaseRepository(ctx.supabase, "alvesz_eventos", ctx.userId).findAll(
        "data_evento"
      ),
    ]);

    if (
      incomeRes.error &&
      !isMissingSupabaseTableError(incomeRes.error)
    ) {
      return { data: null, error: incomeRes.error };
    }
    if (goalsRes.error && !isMissingSupabaseTableError(goalsRes.error)) {
      return { data: null, error: goalsRes.error };
    }

    financialIncome = (incomeRes.data ?? []) as FinancialIncome[];
    financialGoals = (goalsRes.data ?? []) as FinancialGoal[];
    alveszEventos = (eventosRes.data ?? []) as AlveszEvento[];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: message };
  }

  return {
    data: {
      ...base,
      financialIncome,
      financialGoals,
      alveszEventos,
    },
    error: null,
  };
}

export async function getExecutiveReport(
  type: ExecutiveReportType
): Promise<{
  report: ExecutiveReportPayload | null;
  error: string | null;
}> {
  const { data, error } = await loadExecutiveReportData();
  if (error || !data) {
    return { report: null, error };
  }
  return { report: buildExecutiveReport(type, data), error: null };
}

function resolveAnalysisError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return "Erro ao gerar análise. Tente novamente.";
}

export async function generateExecutiveReportAnalysis(
  type: ExecutiveReportType,
  report: ExecutiveReportPayload
): Promise<{ analysis: ExecutiveReportAnalysis; error: string | null }> {
  const { data, error: loadError } = await loadExecutiveReportData();
  if (loadError || !data) {
    return {
      analysis: {
        funcionou: "Dados indisponíveis para análise.",
        naoFuncionou: loadError ?? "Não foi possível carregar o CRM.",
        maiorOportunidade: "Cadastre leads e metas nos módulos.",
        maiorRisco: "—",
        proximaPrioridade: "Abra o relatório novamente após sincronizar.",
      },
      error: loadError,
    };
  }

  const fallback = () => buildReportAnalysisFallback(report, data);

  if (!process.env.OPENAI_API_KEY) {
    return { analysis: fallback(), error: null };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é a Aura Central analisando relatórios executivos de Anderson Alves.
Use APENAS o relatório e contexto fornecidos. Português do Brasil, tom executivo e direto.
Responda APENAS JSON:
{
  "funcionou": "string",
  "naoFuncionou": "string",
  "maiorOportunidade": "string",
  "maiorRisco": "string",
  "proximaPrioridade": "string"
}`,
        },
        {
          role: "user",
          content: `Tipo: ${type}\n\nRelatório:\n${report.text}\n\nLeads ativos: ${data.leads.filter((l) => l.status !== "fechado" && l.status !== "perdido").length}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ExecutiveReportAnalysis>;

    const analysis: ExecutiveReportAnalysis = {
      funcionou: String(parsed.funcionou ?? fallback().funcionou),
      naoFuncionou: String(parsed.naoFuncionou ?? fallback().naoFuncionou),
      maiorOportunidade: String(parsed.maiorOportunidade ?? fallback().maiorOportunidade),
      maiorRisco: String(parsed.maiorRisco ?? fallback().maiorRisco),
      proximaPrioridade: String(parsed.proximaPrioridade ?? fallback().proximaPrioridade),
    };

    return { analysis, error: null };
  } catch (error) {
    console.error("[reports] analysis", error);
    return { analysis: fallback(), error: resolveAnalysisError(error) };
  }
}
