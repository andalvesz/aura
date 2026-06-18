import { syncGrowthPatternsFromMemories } from "@/lib/supabase/services/growth-brain.service";

export async function POST() {
  const { patterns, error } = await syncGrowthPatternsFromMemories();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({
    message: `${patterns.length} padrão(ões) sincronizado(s).`,
    patterns,
  });
}
