import {
  cancelOperation,
  getOperationCenterState,
  sendOperationToPerformanceAi,
} from "@/lib/supabase/services/operation-center.service";

export async function GET() {
  const { dashboard, error } = await getOperationCenterState();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard });
}

export async function POST(request: Request) {
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
}
