import { runAffiliateAnalysis } from "@/lib/supabase/services/platform-hub.service";

export async function POST() {
  const { analyses, error } = await runAffiliateAnalysis();

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 400 }
    );
  }

  return Response.json({ analyses });
}
