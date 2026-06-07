import OpenAI from "openai";
import { getUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { runGlobalSearch } from "@/lib/search/global-search";
import { createClient } from "@/lib/supabase/server";
import { listAuraMemories } from "@/lib/supabase/services/ai-memories.service";
import { listGoals } from "@/lib/supabase/services/goals.service";
import { listNotifications } from "@/lib/supabase/services/notifications.service";
import { getAuraXpState } from "@/lib/supabase/services/xp.service";
import type {
  DiagnosticCheck,
  DiagnosticModule,
  DiagnosticReport,
  DiagnosticSection,
  DiagnosticStatus,
} from "@/utils/diagnostics";
import { countStatuses, rollupStatus } from "@/utils/diagnostics";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { logSupabaseError } from "@/lib/logs/record";

type TableProbe = {
  table: string;
  optional?: boolean;
};

type ModuleDef = {
  id: string;
  label: string;
  tables: TableProbe[];
  runApi?: () => Promise<{ label: string; status: DiagnosticStatus; message: string; detail?: string }>;
};

async function probeTable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  optional = false
): Promise<DiagnosticCheck> {
  const { error } = await supabase.from(table as "profiles").select("id").limit(1);

  if (!error) {
    return {
      id: `table-${table}`,
      label: `Tabela ${table}`,
      kind: "table",
      status: "ok",
      message: "Acessível",
    };
  }

  const message = error.message ?? "Erro desconhecido";

  if (isMissingSupabaseTableError(message)) {
    logSupabaseError("diagnostico", `probe ${table}`, message);
    return {
      id: `table-${table}`,
      label: `Tabela ${table}`,
      kind: "table",
      status: optional ? "warning" : "error",
      message: optional ? "Tabela opcional ausente" : "Tabela faltando",
      detail: table,
    };
  }

  return {
    id: `table-${table}`,
    label: `Tabela ${table}`,
    kind: "table",
    status: "error",
    message: message.slice(0, 160),
    detail: table,
  };
}

function moduleMessage(checks: DiagnosticCheck[]): string {
  const missing = checks.filter(
    (c) => c.kind === "table" && c.message.toLowerCase().includes("faltando")
  );
  const apiFail = checks.find((c) => c.kind === "api" && c.status === "error");
  const optional = checks.filter((c) => c.status === "warning");

  if (apiFail) return "API falhando";
  if (missing.length > 0) return `Tabela faltando: ${missing.map((c) => c.detail).join(", ")}`;
  if (optional.length > 0) return "Operacional com ressalvas";
  return "Operacional";
}

async function buildModuleChecks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  def: ModuleDef
): Promise<DiagnosticModule> {
  const tableChecks = await Promise.all(
    def.tables.map(({ table, optional }) => probeTable(supabase, table, optional))
  );

  const checks = [...tableChecks];

  if (def.runApi) {
    try {
      const api = await def.runApi();
      checks.push({
        id: `${def.id}-api`,
        label: api.label,
        kind: "api",
        status: api.status,
        message: api.message,
        detail: api.detail,
      });
    } catch (err) {
      checks.push({
        id: `${def.id}-api`,
        label: "API",
        kind: "api",
        status: "error",
        message: err instanceof Error ? err.message : "Falha inesperada na API",
      });
    }
  }

  const status = rollupStatus(checks.map((c) => c.status));

  return {
    id: def.id,
    label: def.label,
    status,
    message: moduleMessage(checks),
    checks,
  };
}

const MODULE_DEFS: ModuleDef[] = [
  {
    id: "financeiro",
    label: "Financeiro",
    tables: [
      { table: "gastos" },
      { table: "financial_goals" },
      { table: "financial_income" },
      { table: "financial_balance" },
    ],
  },
  {
    id: "calendario",
    label: "Calendário",
    tables: [{ table: "eventos" }, { table: "google_calendar_connections", optional: true }],
  },
  {
    id: "crescimento",
    label: "Crescimento",
    tables: [
      { table: "growth_goals" },
      { table: "growth_missions" },
      { table: "growth_leads" },
      { table: "growth_profiles", optional: true },
      { table: "growth_actions", optional: true },
      { table: "growth_analyses", optional: true },
    ],
  },
  {
    id: "alvesz",
    label: "Alvesz",
    tables: [
      { table: "clientes" },
      { table: "orcamentos" },
      { table: "estoque" },
      { table: "alvesz_eventos", optional: true },
      { table: "alvesz_propostas", optional: true },
    ],
  },
  {
    id: "saude",
    label: "Saúde",
    tables: [
      { table: "health_habits" },
      { table: "health_workouts" },
      { table: "health_meals", optional: true },
      { table: "health_sessions", optional: true },
    ],
  },
  {
    id: "social-media",
    label: "Social Media",
    tables: [{ table: "conteudos" }],
  },
  {
    id: "metas",
    label: "Metas",
    tables: [{ table: "goals" }],
    runApi: async () => {
      const { goals, error } = await listGoals();
      if (error === "Usuário não autenticado.") {
        return { label: "API /api/goals", status: "error", message: error };
      }
      if (error) {
        return {
          label: "API /api/goals",
          status: isMissingSupabaseTableError(error) ? "error" : "error",
          message: "API falhando",
          detail: error,
        };
      }
      return {
        label: "API /api/goals",
        status: "ok",
        message: `${goals.length} meta(s) carregada(s)`,
      };
    },
  },
  {
    id: "notificacoes",
    label: "Notificações",
    tables: [{ table: "notifications" }],
    runApi: async () => {
      const { notifications, error } = await listNotifications();
      if (error === "Usuário não autenticado.") {
        return { label: "API /api/notifications", status: "error", message: error };
      }
      if (error) {
        return {
          label: "API /api/notifications",
          status: "error",
          message: "API falhando",
          detail: error,
        };
      }
      return {
        label: "API /api/notifications",
        status: "ok",
        message: `${notifications.length} notificação(ões)`,
      };
    },
  },
  {
    id: "xp",
    label: "XP",
    tables: [{ table: "user_xp" }, { table: "xp_history", optional: true }],
    runApi: async () => {
      const { state, error } = await getAuraXpState();
      if (error === "Usuário não autenticado.") {
        return { label: "API /api/xp", status: "error", message: error };
      }
      if (error || !state) {
        return {
          label: "API /api/xp",
          status: "error",
          message: "API falhando",
          detail: error ?? "Estado XP indisponível",
        };
      }
      return {
        label: "API /api/xp",
        status: "ok",
        message: `Nível ${state.progress.level} · ${state.userXp.xp_total} XP`,
      };
    },
  },
  {
    id: "busca-global",
    label: "Busca Global",
    tables: [{ table: "growth_leads", optional: true }],
    runApi: async () => {
      const { total, error } = await runGlobalSearch("aa", { filter: "todos", limit: 1 });
      if (error === "Usuário não autenticado.") {
        return { label: "API /api/aura-search", status: "error", message: error };
      }
      if (error) {
        return {
          label: "API /api/aura-search",
          status: "error",
          message: "API falhando",
          detail: error,
        };
      }
      return {
        label: "API /api/aura-search",
        status: "ok",
        message: `Busca funcional (${total} resultado(s) para probe)`,
      };
    },
  },
  {
    id: "memoria",
    label: "Memória",
    tables: [{ table: "ai_memories" }],
    runApi: async () => {
      const { memories, error } = await listAuraMemories({ categoria: "all", limit: 1 });
      if (error === "Usuário não autenticado.") {
        return { label: "API /api/memory", status: "error", message: error };
      }
      if (error) {
        return {
          label: "API /api/memory",
          status: "error",
          message: "API falhando",
          detail: error,
        };
      }
      return {
        label: "API /api/memory",
        status: "ok",
        message: `${memories.length} memória(s) acessível(eis)`,
      };
    },
  },
];

const CORE_TABLES = [
  "profiles",
  "gastos",
  "eventos",
  "clientes",
  "growth_leads",
  "notifications",
  "goals",
  "ai_memories",
];

async function runSupabaseSection(): Promise<DiagnosticSection> {
  const checks: DiagnosticCheck[] = [];

  if (!hasSupabaseEnv()) {
    checks.push({
      id: "supabase-env",
      label: "Variáveis de ambiente",
      kind: "env",
      status: "error",
      message: "NEXT_PUBLIC_SUPABASE_URL ou ANON_KEY ausentes",
    });

    return {
      id: "supabase",
      title: "Supabase",
      status: "error",
      checks,
    };
  }

  checks.push({
    id: "supabase-env",
    label: "Variáveis de ambiente",
    kind: "env",
    status: "ok",
    message: "URL e anon key configuradas",
  });

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    supabase = await createClient();
    checks.push({
      id: "supabase-connection",
      label: "Conexão",
      kind: "connection",
      status: "ok",
      message: "Cliente Supabase inicializado",
    });
  } catch (err) {
    checks.push({
      id: "supabase-connection",
      label: "Conexão",
      kind: "connection",
      status: "error",
      message: err instanceof Error ? err.message : "Falha ao conectar",
    });

    return {
      id: "supabase",
      title: "Supabase",
      status: "error",
      checks,
    };
  }

  const user = await getUser();
  if (!user) {
    checks.push({
      id: "supabase-auth",
      label: "Autenticação",
      kind: "auth",
      status: "error",
      message: "Sessão não encontrada",
    });
  } else {
    checks.push({
      id: "supabase-auth",
      label: "Autenticação",
      kind: "auth",
      status: "ok",
      message: user.email ?? user.id,
    });
  }

  const tableChecks = await Promise.all(
    CORE_TABLES.map((table) => probeTable(supabase!, table))
  );
  checks.push({
    id: "supabase-tables-summary",
    label: "Tabelas principais",
    kind: "table",
    status: rollupStatus(tableChecks.map((c) => c.status)),
    message: `${tableChecks.filter((c) => c.status === "ok").length}/${tableChecks.length} acessíveis`,
  });
  checks.push(...tableChecks);

  return {
    id: "supabase",
    title: "Supabase",
    status: rollupStatus(checks.map((c) => c.status)),
    checks,
  };
}

async function runOpenAiSection(): Promise<DiagnosticSection> {
  const checks: DiagnosticCheck[] = [];

  if (!process.env.OPENAI_API_KEY?.trim()) {
    checks.push({
      id: "openai-key",
      label: "Chave OPENAI_API_KEY",
      kind: "env",
      status: "warning",
      message: "Não configurada — recursos de IA indisponíveis",
    });

    return {
      id: "openai",
      title: "OpenAI",
      status: "warning",
      checks,
    };
  }

  checks.push({
    id: "openai-key",
    label: "Chave OPENAI_API_KEY",
    kind: "env",
    status: "ok",
    message: "Configurada",
  });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: 'Responda apenas a palavra "OK".' }],
      max_tokens: 8,
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";

    checks.push({
      id: "openai-ping",
      label: "Resposta simples",
      kind: "api",
      status: text ? "ok" : "warning",
      message: text ? `Resposta: ${text.slice(0, 40)}` : "Resposta vazia",
    });
  } catch (err) {
    checks.push({
      id: "openai-ping",
      label: "Resposta simples",
      kind: "api",
      status: "error",
      message: "API falhando",
      detail: err instanceof Error ? err.message.slice(0, 120) : undefined,
    });
  }

  return {
    id: "openai",
    title: "OpenAI",
    status: rollupStatus(checks.map((c) => c.status)),
    checks,
  };
}

async function runModulesSection(
  supabase: Awaited<ReturnType<typeof createClient>> | null
): Promise<DiagnosticSection> {
  if (!supabase) {
    return {
      id: "modules",
      title: "Módulos",
      status: "error",
      checks: [
        {
          id: "modules-skipped",
          label: "Verificação de módulos",
          kind: "connection",
          status: "error",
          message: "Supabase indisponível — módulos não testados",
        },
      ],
      modules: [],
    };
  }

  const modules = await Promise.all(
    MODULE_DEFS.map((def) => buildModuleChecks(supabase, def))
  );

  return {
    id: "modules",
    title: "Módulos",
    status: rollupStatus(modules.map((m) => m.status)),
    checks: [
      {
        id: "modules-count",
        label: "Módulos verificados",
        kind: "connection",
        status: rollupStatus(modules.map((m) => m.status)),
        message: `${modules.filter((m) => m.status === "ok").length}/${modules.length} OK`,
      },
    ],
    modules,
  };
}

export async function runAuraDiagnostics(): Promise<DiagnosticReport> {
  const started = Date.now();

  const supabaseSection = await runSupabaseSection();
  const openAiSection = await runOpenAiSection();

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  if (hasSupabaseEnv()) {
    try {
      supabase = await createClient();
    } catch {
      supabase = null;
    }
  }

  const modulesSection = await runModulesSection(supabase);

  const sections: DiagnosticSection[] = [supabaseSection, openAiSection, modulesSection];

  const report: DiagnosticReport = {
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    summary: { ok: 0, warning: 0, error: 0 },
    sections,
  };

  report.summary = countStatuses(report);
  return report;
}
