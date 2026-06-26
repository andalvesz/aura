import { getExpertTranscriptById, getExpertTranscriptForLesson } from "@/lib/supabase/services/expert-brain-transcription.service";
import { jsonRouteError } from "@/utils/api-json-route";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get("lessonId");
    const transcriptId = searchParams.get("transcriptId");

    if (!lessonId && !transcriptId) {
      return Response.json({ error: "Informe lessonId ou transcriptId." }, { status: 400 });
    }

    const result = lessonId
      ? await getExpertTranscriptForLesson(lessonId)
      : await getExpertTranscriptById(transcriptId!);

    if (result.error || !result.transcript) {
      const status = result.error === "Usuário não autenticado." ? 401 : 404;
      return Response.json({ error: result.error ?? "Transcrição não encontrada." }, { status });
    }

    return Response.json({
      transcript: result.transcript,
      text: result.text,
    });
  } catch (error) {
    return jsonRouteError("expert-brain-transcript", error);
  }
}
