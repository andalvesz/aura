/**
 * Production environment checklist — used by docs + test:production.
 * Does not load secrets into client bundles when imported only from tests/server.
 */

export type EnvRequirement = {
  key: string;
  required: boolean;
  /** Where it must be set */
  surfaces: Array<"vercel" | "supabase-auth" | "local">;
  description: string;
  secret: boolean;
};

export const PRODUCTION_ENV_REQUIREMENTS: EnvRequirement[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    surfaces: ["vercel", "local"],
    description: "URL do projeto Supabase (https://<ref>.supabase.co)",
    secret: false,
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    surfaces: ["vercel", "local"],
    description: "Anon public key (JWT). Nunca use service role no browser.",
    secret: true,
  },
  {
    key: "NEXT_PUBLIC_SITE_URL",
    required: true,
    surfaces: ["vercel", "local", "supabase-auth"],
    description:
      "URL pública do app (ex.: https://aura-ten-rose.vercel.app). Obrigatória em produção.",
    secret: false,
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: false,
    surfaces: ["vercel", "local"],
    description:
      "Somente server/scripts de admin. Nunca NEXT_PUBLIC_*. Opcional para o app runtime.",
    secret: true,
  },
  {
    key: "OPENAI_API_KEY",
    required: false,
    surfaces: ["vercel", "local"],
    description: "OCR / IA / Smart Capture. Sem ela, OCR e rotas de IA degradam.",
    secret: true,
  },
  {
    key: "PLATFORM_CREDENTIALS_KEY",
    required: false,
    surfaces: ["vercel", "local"],
    description: "Criptografia de credenciais de integrações (32 bytes hex/base64).",
    secret: true,
  },
  {
    key: "CRON_SECRET",
    required: false,
    surfaces: ["vercel"],
    description: "Autoriza Vercel Cron → /api/expert-brain-queue.",
    secret: true,
  },
  {
    key: "GOOGLE_CLIENT_ID",
    required: false,
    surfaces: ["vercel", "local"],
    description: "OAuth Google (Calendar / Gmail / Drive).",
    secret: false,
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    required: false,
    surfaces: ["vercel", "local"],
    description: "OAuth Google secret.",
    secret: true,
  },
  {
    key: "META_APP_ID",
    required: false,
    surfaces: ["vercel", "local"],
    description: "Meta Marketing API (opcional).",
    secret: false,
  },
  {
    key: "META_APP_SECRET",
    required: false,
    surfaces: ["vercel", "local"],
    description: "Meta app secret (opcional).",
    secret: true,
  },
];

export const PRODUCTION_ROUTE_SMOKE = [
  "/",
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/offline",
  "/sem-permissao",
  "/dashboard",
  "/dashboard/discovery",
  "/dashboard/knowledge",
  "/dashboard/projects",
  "/dashboard/decisions",
  "/dashboard/scenarios",
  "/dashboard/priorities",
  "/dashboard/inbox",
  "/dashboard/attachments",
] as const;

export const BRAIN_MIGRATIONS_RC4_2 = [
  "20260727120000_multiuser_workspaces_v1.sql",
  "20260728120000_multiuser_rls_hardening_v1.sql",
  "20260728180000_aura_brain_core_v1.sql",
  "20260728190000_mission_engine_v1.sql",
  "20260728200000_identity_engine_v1.sql",
  "20260728210000_memory_engine_v1.sql",
  "20260728220000_world_model_v1.sql",
  "20260728230000_cognitive_engine_v1.sql",
  "20260729120000_discovery_engine_v1.sql",
  "20260729140000_rc2_1_collaborative_go_live.sql",
  "20260729160000_rc3_daily_operations.sql",
  "20260729180000_rc3_1_smart_capture.sql",
  "20260729200000_rc4_projects_business_os.sql",
  "20260729220000_rc4_1_knowledge_hub.sql",
  "20260729230000_sprint7_decision_support.sql",
  "20260729240000_sprint7_1_scenario_engine.sql",
  "20260729250000_sprint7_2_prioritization.sql",
] as const;

export function requiredProductionEnvKeys(): string[] {
  return PRODUCTION_ENV_REQUIREMENTS.filter((e) => e.required).map((e) => e.key);
}

export function missingRequiredEnv(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  return requiredProductionEnvKeys().filter((key) => !env[key]?.trim());
}

export function assertProductionEnvShape(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing = missingRequiredEnv(env);
  const warnings: string[] = [];
  const site = env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (
    env.NODE_ENV === "production" &&
    site &&
    /localhost|127\.0\.0\.1/i.test(site)
  ) {
    warnings.push("NEXT_PUBLIC_SITE_URL não pode ser localhost em produção");
  }
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes("service_role")) {
    warnings.push("NEXT_PUBLIC_SUPABASE_ANON_KEY parece service_role — perigo");
  }
  return { ok: missing.length === 0 && warnings.length === 0, missing, warnings };
}
