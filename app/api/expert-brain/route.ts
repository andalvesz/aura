import { getExpertBrainDashboard } from "@/lib/supabase/services/expert-brain-dashboard.service";
import { emptyExpertBrainDashboard } from "@/utils/expert-brain-dashboard";

export async function GET() {
  try {
    const { dashboard, warnings, error } = await getExpertBrainDashboard();

    if (error) {
      return Response.json(
        {
          dashboard: emptyExpertBrainDashboard(),
          warnings,
          error,
        },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    return Response.json({ dashboard, warnings });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[expert-brain-dashboard] unhandled route error", {
      error: err,
      message,
    });

    return Response.json({
      dashboard: emptyExpertBrainDashboard(),
      warnings: [
        {
          table: "expert-brain-dashboard",
          error: message,
          message,
        },
      ],
      error: null,
    });
  }
}
