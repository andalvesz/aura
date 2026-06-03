import { loadRecentMemoriesSnapshot } from "@/lib/supabase/services/memory.service";

export async function GET() {
  try {
    const { snapshot, error } = await loadRecentMemoriesSnapshot();

    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }

    if (error) {
      return Response.json({ error: "Não foi possível carregar memórias." }, { status: 500 });
    }

    return Response.json(snapshot);
  } catch (err) {
    console.error("[memory/recent]", err);
    return Response.json({ error: "Erro ao carregar memórias." }, { status: 500 });
  }
}
