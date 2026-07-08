import {
  advanceMission,
  approveMissionForLaunch,
  getMissionStatus,
  startMission,
} from "@/lib/supabase/services/master-flow.service";
import { getOptionalDataContext } from "@/lib/supabase/services/context";
import type { MasterFlowIntentInput } from "@/utils/master-flow-intent";

const NO_MISSION_MESSAGE = "Nenhuma missão encontrada.";

function authStatus(error: string): number {
  return error === "Usuário não autenticado." ? 401 : 500;
}

function isNoMissionError(error: string | null | undefined): boolean {
  return (error ?? "").trim() === NO_MISSION_MESSAGE;
}

async function resolveUserIdForLog(): Promise<string | null> {
  try {
    const ctx = await getOptionalDataContext();
    return ctx?.userId ?? null;
  } catch {
    return null;
  }
}

function masterFlowFatal(error: unknown, status = 500): Response {
  console.error("[master-flow] fatal", error);

  const err = error instanceof Error ? error : new Error(String(error));
  return Response.json(
    {
      success: false,
      error: err.message,
      name: err.name,
      stack: err.stack ?? null,
    },
    { status }
  );
}

function masterFlowServiceError(error: string, status: number): Response {
  console.error("[master-flow] fatal", error);
  return Response.json(
    {
      success: false,
      error,
      name: "MasterFlowServiceError",
      stack: null,
      mission: null,
    },
    { status }
  );
}

function noMissionResponse(): Response {
  return Response.json({
    success: true,
    mission: null,
    message: NO_MISSION_MESSAGE,
  });
}

function selectedOpportunityFromIntent(intent?: MasterFlowIntentInput | null) {
  if (!intent) return null;
  return {
    niche: intent.niche ?? null,
    country: intent.country ?? null,
    language: intent.language ?? null,
    avatar: intent.avatar ?? null,
    ticket: intent.ticket ?? null,
    raw: intent.raw ?? null,
  };
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
        {
          success: false,
          error: "Ação GET inválida. Use action=status.",
          name: "InvalidAction",
          stack: null,
        },
        { status: 400 }
      );
    }

    console.info("[master-flow] before getMissionStatus", {
      action,
      userId,
      flowId: flowId ?? null,
    });

    const { mission, error } = await getMissionStatus(flowId);

    console.info("[master-flow] after getMissionStatus", {
      action,
      userId,
      flowId: flowId ?? null,
      hasMission: Boolean(mission),
      error: error ?? null,
    });

    if (!mission && isNoMissionError(error)) {
      return noMissionResponse();
    }

    if (error && !mission) {
      return masterFlowServiceError(error, authStatus(error));
    }

    return Response.json({ success: true, mission, error: error ?? null });
  } catch (error) {
    return masterFlowFatal(error);
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
    const payloadKeys = Object.keys(body);

    console.info("[master-flow] POST", {
      action,
      userId,
      flowId: flowId ?? null,
      payloadKeys,
    });

    if (action === "start") {
      const selectedOpportunity = selectedOpportunityFromIntent(body.intent);

      console.info("[master-flow] before startMission", {
        action,
        userId,
        payloadKeys,
        selectedOpportunity,
      });

      const { mission, error } = await startMission(body.intent);

      console.info("[master-flow] after startMission", {
        action,
        userId,
        payloadKeys,
        selectedOpportunity,
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
      console.info("[master-flow] before getMissionStatus", {
        action,
        userId,
        flowId: flowId ?? null,
      });

      const { mission, error } = await getMissionStatus(flowId);

      console.info("[master-flow] after getMissionStatus", {
        action,
        userId,
        flowId: flowId ?? null,
        hasMission: Boolean(mission),
        error: error ?? null,
      });

      if (!mission && isNoMissionError(error)) {
        return noMissionResponse();
      }

      if (error && !mission) {
        return masterFlowServiceError(error, authStatus(error));
      }
      return Response.json({ success: true, mission, error: error ?? null });
    }

    return Response.json(
      {
        success: false,
        error: `Ação inválida: ${action}. Use start, advance, approve ou status.`,
        name: "InvalidAction",
        stack: null,
      },
      { status: 400 }
    );
  } catch (error) {
    return masterFlowFatal(error);
  }
}
