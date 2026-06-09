import { toggleCreatorChecklistItem } from "@/lib/supabase/services/creator.service";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      itemId?: string;
      status?: "pendente" | "feito";
    };

    if (!body.itemId || !body.status) {
      return Response.json({ error: "itemId e status são obrigatórios." }, { status: 400 });
    }

    const { bundle, error } = await toggleCreatorChecklistItem(body.itemId, body.status);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ bundle });
  } catch {
    return Response.json({ error: "Erro ao atualizar checklist." }, { status: 500 });
  }
}
