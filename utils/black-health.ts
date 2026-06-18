import type { SystemLog } from "@/types/database";

export type BlackHealthCardId =
  | "growth-brain-feeds"
  | "revenue-ai-feeds"
  | "market-hunter-feeds"
  | "decision-engine"
  | "operation-approvals"
  | "kiwify-syncs"
  | "meta-syncs";

export type BlackHealthCardConfig = {
  id: BlackHealthCardId;
  label: string;
  description: string;
};

export const BLACK_HEALTH_CARDS: BlackHealthCardConfig[] = [
  {
    id: "growth-brain-feeds",
    label: "Growth Brain feeds",
    description: "Memórias registradas e feeds cruzados",
  },
  {
    id: "revenue-ai-feeds",
    label: "Revenue AI feeds",
    description: "Métricas de receita registradas",
  },
  {
    id: "market-hunter-feeds",
    label: "Market Hunter feeds",
    description: "Oportunidades alimentadas por fontes externas",
  },
  {
    id: "decision-engine",
    label: "Decision Engine",
    description: "Decisões unificadas computadas",
  },
  {
    id: "operation-approvals",
    label: "Operation approvals",
    description: "Aprovações e ações do Operation Center",
  },
  {
    id: "kiwify-syncs",
    label: "Kiwify syncs",
    description: "Sincronizações e feeds Kiwify",
  },
  {
    id: "meta-syncs",
    label: "Meta syncs",
    description: "Sincronizações e feeds Meta Ads",
  },
];

export type BlackHealthStats = {
  total: number;
  errors: number;
  warnings: number;
  successes: number;
  successRate: number;
};

export type BlackHealthCardSnapshot = BlackHealthStats & {
  id: BlackHealthCardId;
  label: string;
  description: string;
  recentLogs: SystemLog[];
};

export type FeedInspectorRow = {
  id: string;
  source: string;
  entityId: string;
  idempotencyKey: string;
  action: string;
  timestamp: string;
  modulo: string;
  mensagem: string;
};

function readDetalhes(log: SystemLog): Record<string, unknown> {
  if (!log.detalhes || typeof log.detalhes !== "object" || Array.isArray(log.detalhes)) {
    return {};
  }
  return log.detalhes as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function messageIncludes(log: SystemLog, term: string): boolean {
  return log.mensagem.toLowerCase().includes(term.toLowerCase());
}

function detalhesIncludes(log: SystemLog, term: string): boolean {
  const raw = JSON.stringify(readDetalhes(log)).toLowerCase();
  return raw.includes(term.toLowerCase());
}

export function matchesBlackHealthCard(log: SystemLog, cardId: BlackHealthCardId): boolean {
  switch (cardId) {
    case "growth-brain-feeds":
      return log.modulo === "growth-brain-feed" || log.modulo === "growth-brain";
    case "revenue-ai-feeds":
      return log.modulo === "revenue-ai";
    case "market-hunter-feeds":
      return log.modulo === "market-hunter";
    case "decision-engine":
      return log.modulo === "decision-engine";
    case "operation-approvals":
      return (
        log.modulo === "operation-center" &&
        (readString(readDetalhes(log).action) === "approve" ||
          messageIncludes(log, "aprov") ||
          messageIncludes(log, "approve"))
      );
    case "kiwify-syncs":
      return (
        log.modulo.includes("kiwify") ||
        messageIncludes(log, "kiwify") ||
        detalhesIncludes(log, "kiwify")
      );
    case "meta-syncs":
      return (
        log.modulo.includes("meta") ||
        messageIncludes(log, "meta") ||
        detalhesIncludes(log, "meta_ads") ||
        detalhesIncludes(log, "meta ads")
      );
    default:
      return false;
  }
}

export function computeBlackHealthStats(logs: SystemLog[]): BlackHealthStats {
  const total = logs.length;
  const errors = logs.filter((log) => log.tipo === "error").length;
  const warnings = logs.filter((log) => log.tipo === "warning").length;
  const successes = logs.filter((log) => log.tipo === "success").length;
  const successRate = total > 0 ? Math.round(((total - errors) / total) * 1000) / 10 : 100;

  return { total, errors, warnings, successes, successRate };
}

export function buildBlackHealthSnapshots(logs: SystemLog[]): BlackHealthCardSnapshot[] {
  return BLACK_HEALTH_CARDS.map((card) => {
    const cardLogs = logs.filter((log) => matchesBlackHealthCard(log, card.id));
    return {
      id: card.id,
      label: card.label,
      description: card.description,
      recentLogs: cardLogs.slice(0, 100),
      ...computeBlackHealthStats(cardLogs),
    };
  });
}

export function extractFeedInspectorRows(logs: SystemLog[]): FeedInspectorRow[] {
  const rows: FeedInspectorRow[] = [];

  for (const log of logs) {
    const detalhes = readDetalhes(log);
    const idempotencyKey = readString(detalhes.idempotencyKey);
    const action = readString(detalhes.action);
    if (!idempotencyKey && !action) continue;

    const entityId =
      readString(detalhes.metricId) ??
      readString(detalhes.memoryId) ??
      readString(detalhes.productId) ??
      readString(detalhes.operationId) ??
      readString(detalhes.entityId) ??
      "—";

    const source =
      readString(detalhes.sourcePlatform) ??
      readString(detalhes.platform) ??
      readString(detalhes.source) ??
      log.modulo;

    rows.push({
      id: log.id,
      source,
      entityId,
      idempotencyKey: idempotencyKey ?? "—",
      action: action ?? "—",
      timestamp: log.created_at,
      modulo: log.modulo,
      mensagem: log.mensagem,
    });
  }

  return rows.slice(0, 500);
}

export function findDuplicateIdempotencyKeys(rows: FeedInspectorRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.idempotencyKey === "—") continue;
    counts.set(row.idempotencyKey, (counts.get(row.idempotencyKey) ?? 0) + 1);
  }
  return counts;
}
