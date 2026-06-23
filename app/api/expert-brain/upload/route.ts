import { processExpertBrainIngestionQueue, registerExpertBrainIngestion } from "@/lib/supabase/services/expert-brain-ingestion.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const file_path = typeof body.file_path === "string" ? body.file_path.trim() : "";
    const course_name = typeof body.course_name === "string" ? body.course_name : null;
    const module_name = typeof body.module_name === "string" ? body.module_name : null;
    const lesson_name = typeof body.lesson_name === "string" ? body.lesson_name : null;
    const file_name = typeof body.file_name === "string" ? body.file_name : null;
    const author = typeof body.author === "string" ? body.author : null;
    const niche = typeof body.niche === "string" ? body.niche : null;

    if (!file_path) {
      return Response.json({ error: "Informe file_path." }, { status: 400 });
    }

    const { ingestionId, error } = await registerExpertBrainIngestion({
      file_path,
      course_name,
      module_name,
      lesson_name,
      file_name,
      author,
      niche,
    });

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 400;
      return Response.json({ error }, { status });
    }

    void processExpertBrainIngestionQueue(1).catch(() => undefined);

    return Response.json({
      ingestionId,
      status: "uploaded",
      message: "Arquivo registrado na fila de processamento.",
    });
  } catch {
    return Response.json({ error: "Erro ao registrar upload." }, { status: 500 });
  }
}
