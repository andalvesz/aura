import {
  connectMetaBusiness,
  disconnectMetaBusiness,
} from "@/lib/supabase/services/meta-connect.service";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    accessToken?: string;
    businessId?: string;
    businessName?: string;
  };

  if (!body.accessToken?.trim()) {
    return Response.json({ error: "Access token obrigatório." }, { status: 400 });
  }

  const { error } = await connectMetaBusiness({
    accessToken: body.accessToken,
    businessId: body.businessId,
    businessName: body.businessName,
  });

  if (error) {
    return Response.json({ error }, { status: 422 });
  }

  return Response.json({ ok: true });
}

export async function DELETE() {
  const { error } = await disconnectMetaBusiness();
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
