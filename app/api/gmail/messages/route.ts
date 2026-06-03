import { fetchRecentGmailMessages } from "@/lib/comms/gmail.service";

export async function GET() {
  try {
    const { messages, error } = await fetchRecentGmailMessages();
    if (error) {
      const status = error.includes("autenticado") ? 401 : 400;
      return Response.json({ error, messages: [] }, { status });
    }
    return Response.json({ messages });
  } catch (error) {
    console.error("[gmail/messages]", error);
    return Response.json({ error: "Erro ao listar e-mails.", messages: [] }, { status: 500 });
  }
}
