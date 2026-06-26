import {
  createBusiness,
  getFlowStatus,
  runFullFlow,
  runNextStep,
} from "@/lib/supabase/services/master-flow.service";
import type { MasterFlowIntentInput } from "@/utils/master-flow-intent";
import { jsonRouteError } from "@/utils/api-json-route";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const flowId = searchParams.get("flowId") ?? undefined;

    const { status, error } = await getFlowStatus(flowId);

    if (error) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
    }

    return Response.json({ status });
  } catch (error) {
    return jsonRouteError("master-flow", error);
  }
}

export async function POST(request: Request) {
  let action = "create";

  try {
    const body = (await request.json()) as {
      action?: string;
      flowId?: string;
      intent?: MasterFlowIntentInput;
    };
    if (body.action) action = body.action;
    const flowId = body.flowId;

    if (action === "run") {
      const { status, error } = await runNextStep(flowId);
      if (error && !status) {
        return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
      }
      return Response.json({ status, error });
    }

    if (action === "run-all") {
      const { status, error } = await runFullFlow(flowId);
      if (error && !status) {
        return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
      }
      return Response.json({ status, error });
    }

    const { status, error } = await createBusiness(body.intent);
    if (error && !status) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
    }

    if (status && !status.isComplete && status.flow.status !== "failed") {
      const full = await runFullFlow(status.flow.id);
      return Response.json({ status: full.status ?? status, error: full.error });
    }

    return Response.json({ status, error });
  } catch (error) {
    return jsonRouteError("master-flow", error);
  }
}
