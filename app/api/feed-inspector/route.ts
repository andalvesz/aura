import { getFeedInspectorRows } from "@/lib/black-health.service";

export async function GET() {
  const { rows, error } = await getFeedInspectorRows();

  if (error === "Usuário não autenticado.") {
    return Response.json({ error }, { status: 401 });
  }

  if (error) {
    return Response.json({ error, rows: [] }, { status: 500 });
  }

  return Response.json({ rows });
}
