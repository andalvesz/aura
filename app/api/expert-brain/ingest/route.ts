import { ingestKnowledgeSource } from "@/lib/supabase/services/expert-brain.service";
import type { ExpertKnowledgeSourceType } from "@/types/database";

const VALID_SOURCE_TYPES: ExpertKnowledgeSourceType[] = [
  "course",
  "video",
  "pdf",
  "transcript",
  "marketing_material",
  "other",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const source_type = body.source_type as ExpertKnowledgeSourceType;
    const raw_text = typeof body.raw_text === "string" ? body.raw_text : "";
    const author = typeof body.author === "string" ? body.author : null;
    const niche = typeof body.niche === "string" ? body.niche : null;
    const origin = typeof body.origin === "string" ? body.origin : null;

    if (!title) {
      return Response.json({ error: "Informe title." }, { status: 400 });
    }
    if (!VALID_SOURCE_TYPES.includes(source_type)) {
      return Response.json({ error: "source_type inválido." }, { status: 400 });
    }
    if (!raw_text.trim()) {
      return Response.json({ error: "Informe raw_text." }, { status: 400 });
    }

    const result = await ingestKnowledgeSource({
      title,
      source_type,
      raw_text,
      author,
      niche,
      origin,
    });

    if (result.error) {
      const status = result.error === "Usuário não autenticado." ? 401 : 400;
      return Response.json({ error: result.error }, { status });
    }

    return Response.json({
      source: result.source,
      frameworks: result.frameworks,
      playbooks: result.playbooks,
      patterns: result.patterns,
      decisionRules: result.decisionRules,
      checklists: result.checklists,
      failurePatterns: result.failurePatterns,
      successPatterns: result.successPatterns,
    });
  } catch {
    return Response.json({ error: "Erro ao ingerir conhecimento." }, { status: 500 });
  }
}
