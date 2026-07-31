/**
 * Platform health checks — no secrets in UI payloads.
 */

export type HealthStatus = "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";

export type HealthComponent = {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
};

export type PlatformHealthReport = {
  overall: HealthStatus;
  checkedAt: string;
  components: HealthComponent[];
};

function rank(s: HealthStatus): number {
  switch (s) {
    case "UNAVAILABLE":
      return 3;
    case "DEGRADED":
      return 2;
    case "UNKNOWN":
      return 1;
    default:
      return 0;
  }
}

export function buildPlatformHealth(input?: {
  supabaseReachable?: boolean | null;
  authOk?: boolean | null;
  storageOk?: boolean | null;
  migrationsApplied?: boolean | null;
  dbTypesFresh?: boolean | null;
  cronOk?: boolean | null;
  providersOk?: boolean | null;
  queuesOk?: boolean | null;
  uploadsOk?: boolean | null;
  ocrOk?: boolean | null;
  automationsOk?: boolean | null;
  agentsOk?: boolean | null;
  recentErrorRate?: number | null;
}): PlatformHealthReport {
  const flag = (
    id: string,
    label: string,
    value: boolean | null | undefined,
    okDetail: string,
    badDetail: string
  ): HealthComponent => {
    if (value == null) {
      return { id, label, status: "UNKNOWN", detail: "Não verificado neste ambiente" };
    }
    return {
      id,
      label,
      status: value ? "HEALTHY" : "UNAVAILABLE",
      detail: value ? okDetail : badDetail,
    };
  };

  const components: HealthComponent[] = [
    flag("supabase", "Supabase", input?.supabaseReachable, "Reachable", "Unreachable"),
    flag("auth", "Auth", input?.authOk, "Session path ok", "Auth degraded"),
    flag("storage", "Storage", input?.storageOk, "Buckets reachable", "Storage issue"),
    flag(
      "migrations",
      "Migrations",
      input?.migrationsApplied,
      "Applied (manual checklist)",
      "Pending / unknown"
    ),
    flag("db_types", "DB types", input?.dbTypesFresh, "Types aligned", "Regenerate recommended"),
    flag("cron", "Cron", input?.cronOk, "Jobs ok", "Cron issue"),
    flag("providers", "Providers", input?.providersOk, "Providers ok", "Provider offline"),
    flag("queues", "Filas", input?.queuesOk, "Queues ok", "Queue backlog"),
    flag("uploads", "Uploads", input?.uploadsOk, "Uploads ok", "Upload failures"),
    flag("ocr", "OCR", input?.ocrOk, "OCR ok", "OCR unavailable"),
    flag("automations", "Automations", input?.automationsOk, "Ok", "Failures"),
    flag("agents", "Agents", input?.agentsOk, "Ok", "Failures"),
  ];

  if (input?.recentErrorRate != null) {
    components.push({
      id: "errors",
      label: "Errors",
      status:
        input.recentErrorRate > 0.2
          ? "UNAVAILABLE"
          : input.recentErrorRate > 0.05
            ? "DEGRADED"
            : "HEALTHY",
      detail: `Taxa recente ${(input.recentErrorRate * 100).toFixed(1)}% (agregado)`,
    });
  } else {
    components.push({
      id: "errors",
      label: "Errors",
      status: "UNKNOWN",
      detail: "Sem amostra",
    });
  }

  let overall: HealthStatus = "HEALTHY";
  for (const c of components) {
    if (rank(c.status) > rank(overall)) overall = c.status;
  }

  return {
    overall,
    checkedAt: new Date().toISOString(),
    components,
  };
}

/** Safe health for admin UI — never includes secrets. */
export function sanitizeHealthForUi(report: PlatformHealthReport): PlatformHealthReport {
  return {
    ...report,
    components: report.components.map((c) => ({
      ...c,
      detail: c.detail.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[redacted]"),
    })),
  };
}
