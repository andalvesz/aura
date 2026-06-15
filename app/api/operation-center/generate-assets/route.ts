import { generateOperationAssets } from "@/lib/supabase/services/operation-center.service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    operationId?: string;
    assetType?: "creatives" | "landing" | "both";
  };

  if (!body.operationId?.trim()) {
    return Response.json({ error: "Informe operationId." }, { status: 400 });
  }

  const assetType = body.assetType ?? "both";
  const { operation, message, error } = await generateOperationAssets(body.operationId, assetType);

  if (error && !operation) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ operation, message, error });
}
