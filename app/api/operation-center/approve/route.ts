import { approveOperation } from "@/lib/supabase/services/operation-center.service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { operationId?: string };

  if (!body.operationId?.trim()) {
    return Response.json({ error: "Informe operationId." }, { status: 400 });
  }

  const { message, error, missing, operation } = await approveOperation(body.operationId);

  if (error && !operation) {
    return Response.json({ error, missing }, { status: missing.length > 0 ? 422 : 500 });
  }

  return Response.json({ message, error, missing, operation });
}
