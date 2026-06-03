import { createClient } from "@/lib/supabase/server";
import type { AlveszPropostaPdfMeta } from "@/utils/alvesz-proposta";

const BUCKET = "alvesz-pdfs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: proposta, error } = await supabase
      .from("alvesz_propostas")
      .select("id, user_id, pdf_meta")
      .eq("id", id.trim())
      .maybeSingle();

    if (error || !proposta) {
      return Response.json({ error: "Proposta não encontrada." }, { status: 404 });
    }

    if (user && proposta.user_id !== user.id) {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    const meta = proposta.pdf_meta as AlveszPropostaPdfMeta | null;
    const storagePath = meta?.storagePath;

    if (!storagePath) {
      return Response.json({ error: "PDF não disponível." }, { status: 404 });
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadError || !file) {
      return Response.json({ error: "Arquivo PDF não encontrado." }, { status: 404 });
    }

    const buffer = await file.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proposta-alvesz-v${meta?.version ?? 1}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[alvesz-proposta-pdf/[id]]", error);
    return Response.json({ error: "Erro ao carregar PDF." }, { status: 500 });
  }
}
