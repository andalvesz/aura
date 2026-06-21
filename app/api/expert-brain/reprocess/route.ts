import { reprocessExpertEntity } from "@/lib/supabase/services/expert-brain-dashboard.service";

const VALID_TYPES = ["lesson", "module", "course"] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entityType = body.entityType;
    const entityId = typeof body.entityId === "string" ? body.entityId.trim() : "";

    if (!VALID_TYPES.includes(entityType)) {
      return Response.json({ error: "entityType inválido." }, { status: 400 });
    }
    if (!entityId) {
      return Response.json({ error: "Informe entityId." }, { status: 400 });
    }

    const { processed, failed, error } = await reprocessExpertEntity({
      entityType,
      entityId,
    });

    if (error) {
      return Response.json(
        { error },
        { status: error === "Usuário não autenticado." ? 401 : 400 }
      );
    }

    return Response.json({
      processed,
      failed,
      message: `Reprocessamento concluído — ${processed} ok, ${failed} falha(s).`,
    });
  } catch {
    return Response.json({ error: "Erro ao reprocessar." }, { status: 500 });
  }
}
