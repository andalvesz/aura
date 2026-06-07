import { runAuraDiagnostics } from "@/lib/diagnostics/run-diagnostics";
import {
  logApiError,
  logDiagnosticRun,
  recordSystemLog,
} from "@/lib/logs/record";

function logDiagnosticIssues(
  report: Awaited<ReturnType<typeof runAuraDiagnostics>>
) {
  logDiagnosticRun({
    ...report.summary,
    durationMs: report.durationMs,
  });

  for (const section of report.sections) {
    for (const check of section.checks) {
      if (check.status === "error") {
        recordSystemLog({
          tipo: "error",
          modulo: section.id === "openai" ? "openai" : "supabase",
          mensagem: `[Diagnóstico] ${check.label}: ${check.message}`,
          detalhes: { section: section.id, check: check.id, detail: check.detail },
        });
      }
    }

    for (const mod of section.modules ?? []) {
      if (mod.status === "error" || mod.status === "warning") {
        recordSystemLog({
          tipo: mod.status === "error" ? "error" : "warning",
          modulo: mod.id,
          mensagem: `[Diagnóstico] ${mod.label}: ${mod.message}`,
          detalhes: {
            checks: mod.checks.map((c) => ({
              label: c.label,
              status: c.status,
              message: c.message,
            })),
          },
        });
      }
    }
  }
}

export async function POST() {
  try {
    const report = await runAuraDiagnostics();
    logDiagnosticIssues(report);
    return Response.json({ report });
  } catch (error) {
    console.error("[diagnostics]", error);
    logApiError("diagnostico", "/api/diagnostics", error, 500);
    return Response.json(
      { error: "Falha ao executar diagnóstico." },
      { status: 500 }
    );
  }
}
