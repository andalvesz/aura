import {
  approveAutopilotAction,
  evaluateAutopilotRules,
  getAutopilotDashboard,
  rejectAutopilotAction,
  runManualAutopilotAction,
  updateAutopilotSettings,
} from "@/lib/supabase/services/autopilot.service";
import type { AutopilotControlLevel } from "@/types/database";
import type { AutopilotRules } from "@/utils/autopilot";

export async function GET() {
  const result = await getAutopilotDashboard();
  if (result.error) {
    return Response.json({ error: result.error }, {
      status: result.error === "Usuário não autenticado." ? 401 : 500,
    });
  }
  return Response.json(result);
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    control_level?: AutopilotControlLevel;
    rules?: AutopilotRules;
  };

  const { settings, error } = await updateAutopilotSettings(body);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ settings });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "evaluate" | "manual" | "approve" | "reject";
    campaignId?: string;
    actionType?: string;
    actionId?: string;
  };

  if (body.action === "evaluate") {
    const result = await evaluateAutopilotRules();
    if (result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json(result);
  }

  if (body.action === "approve" && body.actionId) {
    const { action, error } = await approveAutopilotAction(body.actionId);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ action });
  }

  if (body.action === "reject" && body.actionId) {
    const { error } = await rejectAutopilotAction(body.actionId);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ ok: true });
  }

  if (body.action === "manual" && body.campaignId && body.actionType) {
    const { action, error } = await runManualAutopilotAction({
      campaignId: body.campaignId,
      actionType: body.actionType as Parameters<typeof runManualAutopilotAction>[0]["actionType"],
    });
    if (error) {
      return Response.json({ error }, { status: 400 });
    }
    return Response.json({ action });
  }

  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
