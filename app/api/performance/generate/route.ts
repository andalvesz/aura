import { generatePerformanceReport } from "@/lib/supabase/services/performance.service";

export async function POST() {
  const { report, dashboard, panel, analysis, error } = await generatePerformanceReport();

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ report, dashboard, panel, analysis });
}
