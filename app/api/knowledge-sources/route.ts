import {
  getKnowledgeSourcesDashboard,
  queueDriveLessons,
  type QueueDriveLessonInput,
} from "@/lib/supabase/services/knowledge-sources.service";
import { processKnowledgeJobsBatch } from "@/lib/supabase/services/knowledge-sources-pipeline.service";

export async function GET() {
  const { dashboard, error } = await getKnowledgeSourcesDashboard();
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ dashboard });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      lessons?: QueueDriveLessonInput[];
      limit?: number;
    };

    if (body.action === "process") {
      const result = await processKnowledgeJobsBatch(body.limit ?? 3);
      return Response.json(result);
    }

    if (body.action === "queue_drive") {
      const { queued, error } = await queueDriveLessons(body.lessons ?? []);
      if (error && queued === 0) {
        return Response.json({ error }, { status: 400 });
      }
      const processResult = await processKnowledgeJobsBatch(3);
      return Response.json({ queued, ...processResult });
    }

    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch {
    return Response.json({ error: "Erro na requisição." }, { status: 500 });
  }
}
