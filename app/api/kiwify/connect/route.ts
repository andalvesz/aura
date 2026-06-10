import {
  connectKiwify,
  disconnectKiwify,
} from "@/lib/supabase/services/kiwify-connect.service";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    clientId?: string;
    clientSecret?: string;
    accountId?: string;
    accountLabel?: string;
  };

  if (!body.clientId?.trim() || !body.clientSecret?.trim() || !body.accountId?.trim()) {
    return Response.json(
      { error: "clientId, clientSecret e accountId são obrigatórios." },
      { status: 400 }
    );
  }

  const { error } = await connectKiwify({
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    accountId: body.accountId,
    accountLabel: body.accountLabel,
  });

  if (error) {
    return Response.json({ error }, { status: 422 });
  }

  return Response.json({ ok: true });
}

export async function DELETE() {
  const { error } = await disconnectKiwify();
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
