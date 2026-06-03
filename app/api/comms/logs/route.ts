import { listCommunicationLogs } from "@/lib/comms";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, Number(url.searchParams.get("limit")) || 30);
    const { data, error } = await listCommunicationLogs(limit);

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error, logs: [] }, { status });
    }

    return Response.json({ logs: data });
  } catch (error) {
    console.error("[comms/logs]", error);
    return Response.json({ error: "Erro ao carregar histórico." }, { status: 500 });
  }
}
