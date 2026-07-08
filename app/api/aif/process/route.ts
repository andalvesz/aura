import { NextResponse } from "next/server";
import { getAifHealth, processAifTextIngest } from "@/lib/supabase/services/aif.service";
import type { AifImportSourceType } from "@/utils/aif";

export async function GET() {
  const health = await getAifHealth();
  return NextResponse.json(health);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      title?: string;
      raw_text?: string;
      author?: string;
      niche?: string;
      origin?: string;
      source_type?: AifImportSourceType | string;
      course_id?: string;
      module_id?: string;
      lesson_id?: string;
      existing_source_id?: string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Informe o título." }, { status: 400 });
    }
    if (!body.raw_text?.trim()) {
      return NextResponse.json({ error: "Informe raw_text." }, { status: 400 });
    }

    const result = await processAifTextIngest({
      title: body.title.trim(),
      rawText: body.raw_text.trim(),
      author: body.author ?? null,
      niche: body.niche ?? null,
      origin: body.origin ?? "api",
      sourceType: body.source_type ?? "txt",
      courseId: body.course_id ?? null,
      moduleId: body.module_id ?? null,
      lessonId: body.lesson_id ?? null,
      existingSourceId: body.existing_source_id ?? null,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error, stage: result.stage }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      stage: result.stage,
      expert_source_id: result.expertSourceId,
      entity_count: result.knowledge ? countEntities(result.knowledge) : 0,
      validation: result.knowledge?.validation ?? null,
      graph_edges: result.knowledge?.graph.edges.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno." },
      { status: 500 }
    );
  }
}

function countEntities(knowledge: NonNullable<Awaited<ReturnType<typeof processAifTextIngest>>["knowledge"]>) {
  return (
    knowledge.frameworks.length +
    knowledge.checklists.length +
    knowledge.decisionRules.length +
    knowledge.kpis.length
  );
}
