export type DiagnosticStatus = "ok" | "warning" | "error";

export type DiagnosticKind = "env" | "connection" | "auth" | "table" | "api";

export type DiagnosticCheck = {
  id: string;
  label: string;
  kind: DiagnosticKind;
  status: DiagnosticStatus;
  message: string;
  detail?: string;
};

export type DiagnosticModule = {
  id: string;
  label: string;
  status: DiagnosticStatus;
  message: string;
  checks: DiagnosticCheck[];
};

export type DiagnosticSection = {
  id: string;
  title: string;
  status: DiagnosticStatus;
  checks: DiagnosticCheck[];
  modules?: DiagnosticModule[];
};

export type DiagnosticReport = {
  ranAt: string;
  durationMs: number;
  summary: {
    ok: number;
    warning: number;
    error: number;
  };
  sections: DiagnosticSection[];
};

export function rollupStatus(checks: DiagnosticStatus[]): DiagnosticStatus {
  if (checks.some((s) => s === "error")) return "error";
  if (checks.some((s) => s === "warning")) return "warning";
  return "ok";
}

export function statusLabel(status: DiagnosticStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warning":
      return "Atenção";
    case "error":
      return "Erro";
  }
}

export function formatDiagnosticReport(report: DiagnosticReport): string {
  const lines: string[] = [
    "=== Aura OS — Relatório de Diagnóstico ===",
    `Executado em: ${new Date(report.ranAt).toLocaleString("pt-BR")}`,
    `Duração: ${report.durationMs}ms`,
    `Resumo: ${report.summary.ok} OK · ${report.summary.warning} Atenção · ${report.summary.error} Erro`,
    "",
  ];

  for (const section of report.sections) {
    lines.push(`## ${section.title} [${statusLabel(section.status)}]`);
    for (const check of section.checks) {
      const detail = check.detail ? ` (${check.detail})` : "";
      lines.push(`  - [${statusLabel(check.status)}] ${check.label}: ${check.message}${detail}`);
    }
    if (section.modules?.length) {
      lines.push("");
      for (const mod of section.modules) {
        lines.push(`  ### ${mod.label} [${statusLabel(mod.status)}] — ${mod.message}`);
        for (const check of mod.checks) {
          const detail = check.detail ? ` (${check.detail})` : "";
          lines.push(
            `    - [${statusLabel(check.status)}] ${check.label}: ${check.message}${detail}`
          );
        }
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function countStatuses(report: DiagnosticReport): DiagnosticReport["summary"] {
  let ok = 0;
  let warning = 0;
  let error = 0;

  function tally(status: DiagnosticStatus) {
    if (status === "ok") ok += 1;
    else if (status === "warning") warning += 1;
    else error += 1;
  }

  for (const section of report.sections) {
    for (const check of section.checks) tally(check.status);
    for (const mod of section.modules ?? []) {
      tally(mod.status);
      for (const check of mod.checks) tally(check.status);
    }
  }

  return { ok, warning, error };
}
