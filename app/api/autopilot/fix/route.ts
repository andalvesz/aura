import { fixAutopilotWithAi } from "@/lib/supabase/services/autopilot.service";
import { logApiError } from "@/lib/logs/record";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      actionId?: string;
      message?: string;
    };

    const { text, error } = await fixAutopilotWithAi(body);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ text });
  } catch (err) {
    logApiError("autopilot", "/api/autopilot/fix", err);
    return Response.json({ error: "Erro interno." }, { status: 500 });
  }
}
