import {
  advanceMission,
  approveMissionForLaunch,
  getMissionStatus,
  startMission,
} from "@/lib/supabase/services/master-flow.service";
import { getOptionalDataContext } from "@/lib/supabase/services/context";
import type { MasterFlowIntentInput } from "@/utils/master-flow-intent";

function authStatus(error: string): number {
  return error === "Usuário não autenticado." ? 401 : 500;
}

async function resolveUserIdForLog(): Promise<string | null> {
  try {
    const ctx = await getOptionalDataContext();
    return ctx?.userId ?? null;
  } catch {
    return null;
  }
}

function masterFlowJsonError(error: unknown, status = 500): Response {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? null : null;
  console.error("[master-flow] error", { message, stack });
  return Response.json({ success: false, error: message, stack }, { status });
}

function masterFlowServiceError(error: string, status: number): Response {
  console.error("[master-flow] error", { message: error, stack: null });
  return Response.json({ success: false, mission: null, error, stack: null }, { status });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get("flowId") ?? undefined;
    const action = searchParams.get("action") ?? "status";
    const userId = await resolveUserIdForLog();

    console.info("[master-flow] GET", { action, userId, flowId: flowId ?? null });

    if (action !== "status") {
      return Response.json(
        { success: false, error: "Ação GET inválida. Use action=status.", stack: null },
        { status: 400 }
      );
    }

    console.info("[master-flow] before getMissionStatus", { action, userId, flowId: flowId ?? null });

    const { mission, error } = await getMissionStatus(flowId);

    console.info("[master-flow] after getMissionStatus", {
      action,
      userId,
      flowId: flowId ?? null,
      hasMission: Boolean(mission),
      error: error ?? null,
    });

    if (error && !mission) {
      return masterFlowServiceError(error, authStatus(error));
    }

    return Response.json({ success: true, mission, error: error ?? null });
  } catch (error) {
    return masterFlowJsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await resolveUserIdForLog();
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      flowId?: string;
      intent?: MasterFlowIntentInput;
    };

    const action = body.action ?? "start";
    const flowId = body.flowId;

    console.info("[master-flow] POST", {
      action,
      userId,
      flowId: flowId ?? null,
      payload: body,
    });

    if (action === "start") {
      console.info("[master-flow] before startMission", { action, userId, payload: body });

      const { mission, error } = await startMission(body.intent);

      console.info("[master-flow] after startMission", {
        action,
        userId,
        hasMission: Boolean(mission),
        error: error ?? null,
      });

      if (error && !mission) {
        return masterFlowServiceError(error, authStatus(error));
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    if (action === "advance") {
      const { mission, error } = await advanceMission(flowId);
      if (error && !mission) {
        return masterFlowServiceError(error, authStatus(error));
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    if (action === "approve") {
      const { mission, error } = await approveMissionForLaunch(flowId);
      if (error && !mission) {
        return masterFlowServiceError(error, authStatus(error));
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    if (action === "status") {
      console.info("[master-flow] before getMissionStatus", { action, userId, flowId: flowId ?? null });

      const { mission, error } = await getMissionStatus(flowId);

      console.info("[master-flow] after getMissionStatus", {
        action,
        userId,
        flowId: flowId ?? null,
        hasMission: Boolean(mission),
        error: error ?? null,
      });

      if (error && !mission) {
        return masterFlowServiceError(error, authStatus(error));
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    return Response.json(
      {
        success: false,
        error: `Ação inválida: ${action}. Use start, advance, approve ou status.`,
        stack: null,
      },
      { status: 400 }
    );
  } catch (error) {
    return masterFlowJsonError(error);
  }
}
