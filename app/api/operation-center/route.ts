import { jsonServerError } from "@/lib/api/json-error";
import {
  cancelOperation,
  getOperationCenterState,
  sendOperationToPerformanceAi,
} from "@/lib/supabase/services/operation-center.service";
import { computeOperationCenterDashboard } from "@/utils/operation-center";

function emptyOperationDashboard() {
  return computeOperationCenterDashboard({
    operation: null,
    bundle: null,
    metaConnected: false,
    kiwifyConnected: false,
    hasPerformanceReport: false,
  });
}

export async function GET() {
  try {
    const { dashboard, error } = await getOperationCenterState();
    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }
    return Response.json({ dashboard: dashboard ?? emptyOperationDashboard() });
  } catch (error) {
    console.error("[api/operation-center] GET failed:", error);
    return Response.json({ dashboard: emptyOperationDashboard() });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      operationId?: string;
    };

    if (!body.operationId?.trim()) {
      return Response.json({ error: "Informe operationId." }, { status: 400 });
    }

    switch (body.action) {
      case "performance_ai": {
        const { message, error } = await sendOperationToPerformanceAi(body.operationId);
        if (error && !message) {
          return Response.json({ error }, { status: 500 });
        }
        return Response.json({ message, error });
      }
      case "cancel": {
        const { message, error } = await cancelOperation(body.operationId);
        if (error && !message) {
          return Response.json({ error }, { status: 500 });
        }
        return Response.json({ message, error });
      }
      default:
        return Response.json({ error: "Ação desconhecida." }, { status: 400 });
    }
  } catch (error) {
    console.error("[api/operation-center] POST failed:", error);
    return jsonServerError(error);
  }
}
