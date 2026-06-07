import type { SystemLog, SystemLogTipo } from "@/types/database";

export const SYSTEM_LOG_TIPOS: SystemLogTipo[] = [
  "error",
  "warning",
  "info",
  "success",
];

export const SYSTEM_LOG_MODULOS = [
  "sistema",
  "supabase",
  "openai",
  "auth",
  "api",
  "financeiro",
  "calendario",
  "crescimento",
  "alvesz",
  "saude",
  "social-media",
  "metas",
  "notificacoes",
  "xp",
  "busca-global",
  "memoria",
  "diagnostico",
] as const;

export type SystemLogModulo = (typeof SYSTEM_LOG_MODULOS)[number];

export function systemLogTipoLabel(tipo: SystemLogTipo): string {
  switch (tipo) {
    case "error":
      return "Erro";
    case "warning":
      return "Atenção";
    case "info":
      return "Info";
    case "success":
      return "Sucesso";
  }
}

export function systemLogModuloLabel(modulo: string): string {
  const labels: Record<string, string> = {
    sistema: "Sistema",
    supabase: "Supabase",
    openai: "OpenAI",
    auth: "Autenticação",
    api: "API",
    financeiro: "Financeiro",
    calendario: "Calendário",
    crescimento: "Crescimento",
    alvesz: "Alvesz",
    saude: "Saúde",
    "social-media": "Social Media",
    metas: "Metas",
    notificacoes: "Notificações",
    xp: "XP",
    "busca-global": "Busca Global",
    memoria: "Memória",
    diagnostico: "Diagnóstico",
  };
  return labels[modulo] ?? modulo;
}

export function formatSystemLogsExport(logs: SystemLog[]): string {
  const lines = [
    "=== Aura OS — Central de Logs ===",
    `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
    `Total: ${logs.length} registro(s)`,
    "",
  ];

  for (const log of logs) {
    lines.push(
      `[${new Date(log.created_at).toLocaleString("pt-BR")}] ${systemLogTipoLabel(log.tipo).toUpperCase()} · ${systemLogModuloLabel(log.modulo)}`
    );
    lines.push(`  ${log.mensagem}`);
    if (log.detalhes) {
      lines.push(`  ${JSON.stringify(log.detalhes)}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
