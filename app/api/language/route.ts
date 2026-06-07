import {
  completeExercise,
  completeLesson,
  completeModule,
} from "@/lib/supabase/services/language.service";
import { isValidLanguageModo } from "@/utils/english";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      action?: string;
      lessonId?: string;
      sessionId?: string;
      modo?: string;
    }>(req);

    if (bodyError || !body?.action) {
      return Response.json({ error: bodyError ?? "Ação inválida." }, { status: 400 });
    }

    switch (body.action) {
      case "complete-lesson": {
        if (!body.lessonId) {
          return Response.json({ error: "lessonId obrigatório." }, { status: 400 });
        }
        const result = await completeLesson(body.lessonId);
        if (result.error) {
          return Response.json({ error: result.error }, { status: 422 });
        }
        return Response.json({ lesson: result.lesson });
      }
      case "complete-exercise": {
        if (!body.sessionId) {
          return Response.json({ error: "sessionId obrigatório." }, { status: 400 });
        }
        const result = await completeExercise(body.sessionId);
        if (result.error) {
          return Response.json({ error: result.error }, { status: 422 });
        }
        return Response.json({ session: result.session });
      }
      case "complete-module": {
        if (!body.modo || !isValidLanguageModo(body.modo)) {
          return Response.json({ error: "modo inválido." }, { status: 400 });
        }
        const result = await completeModule(body.modo);
        if (result.error) {
          return Response.json({ error: result.error }, { status: 422 });
        }
        return Response.json({ progress: result.progress });
      }
      default:
        return Response.json({ error: "Ação não suportada." }, { status: 400 });
    }
  } catch (error) {
    console.error("[language]", error);
    return Response.json({ error: "Erro ao processar ação." }, { status: 500 });
  }
}
