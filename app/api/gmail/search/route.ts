import { searchGmailByCliente } from "@/lib/comms/gmail.service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    const nome = url.searchParams.get("nome");

    if (!email?.trim() && !nome?.trim()) {
      return Response.json({ error: "Informe e-mail ou nome do cliente." }, { status: 400 });
    }

    const { messages, error } = await searchGmailByCliente({
      email: email ?? undefined,
      nome: nome ?? undefined,
    });

    if (error) {
      return Response.json({ error, messages: [] }, { status: 400 });
    }

    return Response.json({ messages });
  } catch (error) {
    console.error("[gmail/search]", error);
    return Response.json({ error: "Erro na busca.", messages: [] }, { status: 500 });
  }
}
