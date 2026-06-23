import { queueUploadFile } from "@/lib/supabase/services/knowledge-sources.service";
import { processKnowledgeJobsBatch } from "@/lib/supabase/services/knowledge-sources-pipeline.service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const courseName = (formData.get("course_name") as string | null)?.trim() || null;
    const moduleName = (formData.get("module_name") as string | null)?.trim() || null;
    const lessonName = (formData.get("lesson_name") as string | null)?.trim() || null;

    if (!(file instanceof File)) {
      return Response.json({ error: "Arquivo obrigatório." }, { status: 400 });
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".txt") && !lower.endsWith(".pdf")) {
      return Response.json({ error: "Apenas TXT e PDF são aceitos no upload." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { source, job, error } = await queueUploadFile({
      fileName: file.name,
      buffer,
      courseName,
      moduleName,
      lessonName,
    });

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    const processResult = await processKnowledgeJobsBatch(1);

    return Response.json({ source, job, ...processResult });
  } catch {
    return Response.json({ error: "Erro no upload." }, { status: 500 });
  }
}
