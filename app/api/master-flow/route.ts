import {
  advanceMission,
  approveMissionForLaunch,
  getMissionStatus,
  startMission,
} from "@/lib/supabase/services/master-flow.service";
import type { MasterFlowIntentInput } from "@/utils/master-flow-intent";
import { jsonRouteError } from "@/utils/api-json-route";

function authStatus(error: string): number {
  return error === "Usuário não autenticado." ? 401 : 500;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get("flowId") ?? undefined;
    const action = searchParams.get("action") ?? "status";

    if (action !== "status") {
      return Response.json({ success: false, error: "Ação GET inválida. Use action=status." }, { status: 400 });
    }

    const { mission, error } = await getMissionStatus(flowId);

    if (error && !mission) {
      return Response.json({ success: false, mission: null, error }, { status: authStatus(error) });
    }

    return Response.json({ success: true, mission, error: error ?? null });
  } catch (error) {
    return jsonRouteError("master-flow", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      flowId?: string;
      intent?: MasterFlowIntentInput;
    };

    const action = body.action ?? "start";
    const flowId = body.flowId;

    if (action === "start") {
      const { mission, error } = await startMission(body.intent);
      if (error && !mission) {
        return Response.json({ success: false, mission: null, error }, { status: authStatus(error) });
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    if (action === "advance") {
      const { mission, error } = await advanceMission(flowId);
      if (error && !mission) {
        return Response.json({ success: false, mission: null, error }, { status: authStatus(error) });
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    if (action === "approve") {
      const { mission, error } = await approveMissionForLaunch(flowId);
      if (error && !mission) {
        return Response.json({ success: false, mission: null, error }, { status: authStatus(error) });
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    if (action === "status") {
      const { mission, error } = await getMissionStatus(flowId);
      if (error && !mission) {
        return Response.json({ success: false, mission: null, error }, { status: authStatus(error) });
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    return Response.json(
      { success: false, error: `Ação inválida: ${action}. Use start, advance, approve ou status.` },
      { status: 400 }
    );
  } catch (error) {
    return jsonRouteError("master-flow", error);
  }
}
