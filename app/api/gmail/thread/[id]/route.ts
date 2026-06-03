import { openGmailThread } from "@/lib/comms/gmail.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return Response.json({ error: "Thread inválida." }, { status: 400 });
    }

    const { messages, bodyText, error } = await openGmailThread(id.trim());
    if (error) {
      return Response.json({ error, messages: [], bodyText: "" }, { status: 400 });
    }

    return Response.json({ messages, bodyText });
  } catch (error) {
    console.error("[gmail/thread]", error);
    return Response.json({ error: "Erro ao abrir conversa." }, { status: 500 });
  }
}
