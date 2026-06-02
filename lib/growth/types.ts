/**
 * Tipos e contratos para integrações futuras (Aura IA, Instagram API).
 * Dados manuais cadastrados hoje; métricas externas opcionais depois.
 */

export type GrowthPlatform = "Instagram" | "TikTok" | "YouTube" | "Facebook";

/** Métricas vindas da Instagram API (futuro) — null até integração */
export type InstagramProfileMetrics = {
  followers: number | null;
  following: number | null;
  posts: number | null;
  engagementRate: number | null;
  fetchedAt: string | null;
};

/** Payload enviado ao serviço de análise com IA */
export type ProfileAnalysisInput = {
  profileId: string;
  plataforma: GrowthPlatform | string;
  username: string;
  nicho: string | null;
  objetivo: string | null;
  observacoes: string | null;
  externalMetrics: InstagramProfileMetrics | null;
};

/** Resposta esperada do serviço de análise com IA */
export type ProfileAnalysisResult = {
  summary: string;
  strengths: string[];
  improvements: string[];
  contentIdeas: string[];
  generatedAt: string;
};

/** Contexto para Aura Mentor no módulo Crescimento */
export type GrowthMentorContext = {
  module: "crescimento";
  actionId: string;
  prompt: string;
  profiles: ProfileAnalysisInput[];
  goalsSummary: string | null;
};

/** Identificadores de missão diária (persistidos em growth_missions.mission_key) */
export type DailyMissionKey =
  | "prospectar"
  | "postar"
  | "followup"
  | "oferta"
  | "estudar"
  | "analisar";

export function buildProfileAnalysisInput(profile: {
  id: string;
  plataforma: string;
  username: string;
  nicho: string | null;
  objetivo: string | null;
  observacoes: string | null;
}): ProfileAnalysisInput {
  return {
    profileId: profile.id,
    plataforma: profile.plataforma,
    username: profile.username,
    nicho: profile.nicho,
    objetivo: profile.objetivo,
    observacoes: profile.observacoes,
    externalMetrics: null,
  };
}

export function isSupabaseTableMissingError(message: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find the table") ||
    lower.includes("schema cache") ||
    /relation\s+["']?public\.(growth_|clientes|orcamentos|eventos|estoque|clients|events|budgets)/.test(
      lower
    ) ||
    /table\s+["']?public\.(growth_|clientes|orcamentos|eventos|clients|events|budgets)/.test(
      lower
    )
  );
}
