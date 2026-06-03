import {
  generateExecutiveReportAnalysis,
  getExecutiveReport,
} from "@/lib/supabase/services/reports.service";
import {
  formatReportWithAnalysis,
  type ExecutiveReportType,
} from "@/utils/executive-reports";
import { parseRequestJson } from "@/utils/safe-json";

const VALID_TYPES = new Set<ExecutiveReportType>(["daily", "weekly", "monthly"]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("type") ?? "daily";
    const type = VALID_TYPES.has(raw as ExecutiveReportType)
      ? (raw as ExecutiveReportType)
      : "daily";

    const { report, error } = await getExecutiveReport(type);

    if (error || !report) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error: error ?? "Erro ao gerar relatório." }, { status });
    }

    return Response.json({ report });
  } catch (error) {
    console.error("[executive-reports] GET", error);
    return Response.json({ error: "Erro ao gerar relatório." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      type?: string;
      reportText?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const raw = body.type ?? "weekly";
    const type = VALID_TYPES.has(raw as ExecutiveReportType)
      ? (raw as ExecutiveReportType)
      : "weekly";

    const { report, error: reportError } = await getExecutiveReport(type);
    if (reportError || !report) {
      const status = reportError === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error: reportError ?? "Relatório indisponível." }, { status });
    }

    const { analysis, error: analysisError } = await generateExecutiveReportAnalysis(
      type,
      report
    );

    const fullText = formatReportWithAnalysis(report, analysis);

    return Response.json({
      analysis,
      fullText,
      report,
      warning: analysisError ?? undefined,
    });
  } catch (error) {
    console.error("[executive-reports] POST", error);
    return Response.json({ error: "Erro ao analisar relatório." }, { status: 500 });
  }
}
