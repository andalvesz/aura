import {
  processExpertBrainQueue,
  uploadExpertBrainContent,
  type ExpertUploadMode,
} from "@/lib/supabase/services/expert-brain-dashboard.service";

const VALID_MODES: ExpertUploadMode[] = ["zip", "videos", "pdfs", "transcripts"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const mode = formData.get("mode");
    const courseTitle = formData.get("courseTitle");
    const author = formData.get("author");
    const niche = formData.get("niche");

    if (typeof mode !== "string" || !VALID_MODES.includes(mode as ExpertUploadMode)) {
      return Response.json({ error: "mode inválido." }, { status: 400 });
    }

    const files: Array<{ name: string; buffer: Buffer }> = [];
    const fileEntries = [...formData.getAll("files"), ...formData.getAll("file")];
    for (const value of fileEntries) {
      if (!(value instanceof File) || value.size === 0) continue;
      const buffer = Buffer.from(await value.arrayBuffer());
      files.push({ name: value.name, buffer });
    }

    const { courseId, queued, error } = await uploadExpertBrainContent({
      mode: mode as ExpertUploadMode,
      files,
      courseTitle: typeof courseTitle === "string" ? courseTitle : null,
      author: typeof author === "string" ? author : null,
      niche: typeof niche === "string" ? niche : null,
    });

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 400;
      return Response.json({ error }, { status });
    }

    const queueResult = queued > 0 ? await processExpertBrainQueue(Math.min(queued, 3)) : null;

    return Response.json({
      courseId,
      queued,
      processed: queueResult?.processed ?? 0,
      message: `${queued} aula(s) enfileirada(s).`,
    });
  } catch {
    return Response.json({ error: "Erro ao enviar arquivos." }, { status: 500 });
  }
}
