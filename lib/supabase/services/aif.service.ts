import {
  attachValidationToKnowledge,
  boostConfidenceAfterValidation,
  buildAifKnowledgeGraph,
  ensureAifOperationalDecisionRules,
  filterOperationalRules,
  runAifImportPipeline,
  runAifKnowledgeExtractor,
  runAifKnowledgeNormalizer,
  runAifKnowledgeValidator,
  type AifExtractionDraft,
} from "@/lib/aif";
import {
  ExpertChecklistsRepository,
  ExpertDecisionRulesRepository,
  ExpertFailurePatternsRepository,
  ExpertFrameworksRepository,
  ExpertKnowledgeSourcesRepository,
  ExpertPatternsRepository,
  ExpertPlaybooksRepository,
  ExpertSuccessPatternsRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import { clearSourceArtifacts, extractPlaybooks } from "@/lib/supabase/services/expert-brain.service";
import type {
  ExpertKnowledgeSource,
  ExpertKnowledgeSourceType,
  Json,
  TableInsert,
} from "@/types/database";
import {
  buildAifCeoKnowledgeBlock,
  buildAifExpertContextBlock,
  countAifEntities,
  type AifPipelineInput,
  type AifPipelineResult,
  type AifStructuredKnowledge,
} from "@/utils/aif";
import { getExpertContext, type IngestKnowledgeSourceResult } from "./expert-brain.service";
import { getOptionalDataContext } from "./context";

function mapAifSourceToExpertType(sourceType: string): ExpertKnowledgeSourceType {
  switch (sourceType) {
    case "mp4":
      return "video";
    case "pdf":
      return "pdf";
    case "youtube":
      return "video";
    case "zip":
      return "course";
    case "google_drive":
      return "other";
    case "txt":
    case "docx":
      return "transcript";
    default:
      return "other";
  }
}

export type AifCommitResult = {
  source: ExpertKnowledgeSource | null;
  entityCount: number;
  error: string | null;
};

export type AifCommitMode = "replace" | "append";

export async function commitStructuredKnowledgeToExpertBrain(params: {
  input: AifPipelineInput;
  rawText: string;
  knowledge: AifStructuredKnowledge;
  /** replace = clear existing artifacts (default). append = incremental AIF v2 chunk commit. */
  commitMode?: AifCommitMode;
}): Promise<AifCommitResult> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { source: null, entityCount: 0, error: "Usuário não autenticado." };

  const sourcesRepo = new ExpertKnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const playbooksRepo = new ExpertPlaybooksRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new ExpertPatternsRepository(ctx.supabase, ctx.userId);
  const decisionRulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const checklistsRepo = new ExpertChecklistsRepository(ctx.supabase, ctx.userId);
  const failurePatternsRepo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);
  const successPatternsRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);

  let source: ExpertKnowledgeSource | null = null;
  const commitMode: AifCommitMode = params.commitMode ?? "replace";

  const aifMetadata = {
    aif_version: commitMode === "append" ? "2.0" : "1.0",
    pipeline: "aura_intelligence_factory",
    entity_count: countAifEntities(params.knowledge),
    validation: params.knowledge.validation,
    graph_summary: params.knowledge.graph.nodes.length,
    structured_only: true,
    processed_at: new Date().toISOString(),
    commit_mode: commitMode,
  };

  if (params.input.existingSourceId) {
    const { data: existing, error: loadError } = await sourcesRepo.findById(params.input.existingSourceId);
    if (loadError || !existing) {
      return { source: null, entityCount: 0, error: loadError ?? "Fonte não encontrada." };
    }
    if (commitMode === "replace") {
      const { error: clearError } = await clearSourceArtifacts(existing.id);
      if (clearError) return { source: null, entityCount: 0, error: clearError };
    }

    const { data: updated } = await sourcesRepo.update(existing.id, {
      status: "processing",
      title: params.input.title.trim(),
      source_type: mapAifSourceToExpertType(params.input.sourceType),
      author: params.input.author?.trim() || existing.author,
      niche: params.input.niche?.trim() || existing.niche,
      raw_text: null,
      metadata: {
        ...(typeof existing.metadata === "object" && existing.metadata ? existing.metadata : {}),
        ...aifMetadata,
      } as Json,
    });
    source = updated ?? existing;
  } else {
    const { data: created, error: createError } = await sourcesRepo.create({
      title: params.input.title.trim(),
      source_type: mapAifSourceToExpertType(params.input.sourceType),
      origin: params.input.origin?.trim() || "aif",
      author: params.input.author?.trim() || null,
      niche: params.input.niche?.trim() || null,
      raw_text: null,
      course_id: params.input.courseId ?? null,
      module_id: params.input.moduleId ?? null,
      lesson_id: params.input.lessonId ?? null,
      status: "processing",
      metadata: aifMetadata as Json,
    } satisfies Omit<TableInsert<"expert_knowledge_sources">, "user_id">);

    if (createError || !created) {
      return { source: null, entityCount: 0, error: createError ?? "Erro ao criar fonte." };
    }
    source = created;
  }

  if (!source) return { source: null, entityCount: 0, error: "Erro ao preparar fonte." };

  const frameworkRows = params.knowledge.frameworks.map(
    (fw) =>
      ({
        source_id: source!.id,
        name: fw.name,
        category: fw.category,
        description: fw.summary,
        principles: [...fw.principles, ...params.knowledge.principles.map((p) => p.statement)].slice(
          0,
          8
        ) as unknown as Json,
        when_to_use: fw.whenToUse,
        examples: fw.examples as unknown as Json,
        metadata: { aif_type: "framework", confidence: fw.confidence.value } as Json,
      }) satisfies Omit<TableInsert<"expert_frameworks">, "user_id">
  );

  for (const mm of params.knowledge.mentalModels) {
    frameworkRows.push({
      source_id: source.id,
      name: mm.name,
      category: mm.category,
      description: mm.summary,
      principles: [mm.model, mm.application] as unknown as Json,
      when_to_use: mm.application,
      examples: mm.pitfalls as unknown as Json,
      metadata: { aif_type: "mental_model", confidence: mm.confidence.value } as Json,
    });
  }

  const { data: frameworks, error: fwError } = await frameworksRepo.createMany(frameworkRows);
  if (fwError) {
    await sourcesRepo.update(source.id, { status: "failed" });
    return { source, entityCount: 0, error: fwError };
  }

  const frameworkByName = new Map((frameworks ?? []).map((f) => [f.name.toLowerCase(), f.id]));

  const frameworkDrafts = params.knowledge.frameworks.map((fw) => ({
    name: fw.name,
    category: fw.category,
    description: fw.summary,
    principles: fw.principles,
    when_to_use: fw.whenToUse,
    examples: fw.examples,
  }));

  const { playbooks: playbookDrafts } = await extractPlaybooks({
    frameworks: frameworkDrafts,
    rawText: params.rawText,
  });

  const playbookRows = playbookDrafts.map((draft) => {
    const frameworkId =
      frameworkByName.get(draft.framework_name.toLowerCase()) ?? frameworks?.[0]?.id ?? null;
    return {
      framework_id: frameworkId,
      playbook_type: draft.playbook_type,
      title: draft.title,
      steps: draft.steps as unknown as Json,
      rules: draft.rules as unknown as Json,
      examples: draft.examples as unknown as Json,
      metadata: { aif_pipeline: true } as Json,
    } satisfies Omit<TableInsert<"expert_playbooks">, "user_id">;
  });

  await playbooksRepo.createMany(playbookRows);

  const operationalRules = filterOperationalRules(params.knowledge.decisionRules);
  const decisionRuleRows = operationalRules.map((rule) => ({
    source_id: source!.id,
    framework_id:
      frameworkByName.get((rule.frameworkRef ?? "").toLowerCase()) ?? frameworks?.[0]?.id ?? null,
    title: rule.name,
    category: rule.category,
    rule: rule.rule,
    when_to_apply: rule.whenToApply,
    when_not_to_apply: rule.whenNotToApply,
    confidence_score: rule.confidence.value,
    priority: rule.priority,
    metadata: { aif_type: "decision_rule" } as Json,
  })) satisfies Array<Omit<TableInsert<"expert_decision_rules">, "user_id">>;

  await decisionRulesRepo.createMany(decisionRuleRows);

  const checklistRows = params.knowledge.checklists.map(
    (cl) =>
      ({
        source_id: source!.id,
        title: cl.name,
        checklist_type: cl.checklistType,
        items: cl.items as unknown as Json,
        pass_criteria: cl.passCriteria,
        metadata: { aif_type: "checklist", confidence: cl.confidence.value } as Json,
      }) satisfies Omit<TableInsert<"expert_checklists">, "user_id">
  );
  await checklistsRepo.createMany(checklistRows);

  const patternRows = [
    ...params.knowledge.kpis.map(
      (kpi) =>
        ({
          pattern_type: "heuristic" as const,
          title: kpi.name,
          description: `${kpi.metric} — meta: ${kpi.target} (${kpi.frequency})`,
          applies_to: [kpi.category] as unknown as Json,
          confidence_score: kpi.confidence.value,
          source_ids: [source!.id] as unknown as Json,
          metadata: { aif_type: "kpi", measurement: kpi.measurement } as Json,
        }) satisfies Omit<TableInsert<"expert_patterns">, "user_id">
    ),
    ...params.knowledge.concepts.map(
      (concept) =>
        ({
          pattern_type: "quality_criterion" as const,
          title: concept.name,
          description: concept.definition,
          applies_to: [concept.category] as unknown as Json,
          confidence_score: concept.confidence.value,
          source_ids: [source!.id] as unknown as Json,
          metadata: { aif_type: "concept" } as Json,
        }) satisfies Omit<TableInsert<"expert_patterns">, "user_id">
    ),
  ];
  await patternsRepo.createMany(patternRows);

  const failureRows = params.knowledge.antiPatterns.map(
    (ap) =>
      ({
        source_id: source!.id,
        title: ap.name,
        description: ap.summary,
        warning_signs: ap.warningSigns as unknown as Json,
        consequences: ap.consequences as unknown as Json,
        prevention_actions: ap.prevention as unknown as Json,
        metadata: { aif_type: "anti_pattern", confidence: ap.confidence.value } as Json,
      }) satisfies Omit<TableInsert<"expert_failure_patterns">, "user_id">
  );
  await failurePatternsRepo.createMany(failureRows);

  const successRows = params.knowledge.cases.map(
    (c) =>
      ({
        source_id: source!.id,
        title: c.name,
        description: c.context,
        success_signals: c.lessons as unknown as Json,
        scaling_actions: c.actions as unknown as Json,
        metadata: { aif_type: "case", outcome: c.outcome } as Json,
      }) satisfies Omit<TableInsert<"expert_success_patterns">, "user_id">
  );
  await successPatternsRepo.createMany(successRows);

  const entityCount = countAifEntities(params.knowledge);

  await sourcesRepo.update(source.id, {
    status: "ready",
    metadata: {
      ...aifMetadata,
      frameworks_count: frameworks?.length ?? 0,
      decision_rules_count: operationalRules.length,
      checklists_count: params.knowledge.checklists.length,
      patterns_count: patternRows.length,
      failure_patterns_count: params.knowledge.antiPatterns.length,
      success_patterns_count: params.knowledge.cases.length,
    } as Json,
  });

  console.info("[aif] committed structured knowledge", {
    sourceId: source.id,
    entityCount,
    validationPassed: params.knowledge.validation.passed,
  });

  return { source, entityCount, error: null };
}

function runAifProcessingStages(
  draft: AifExtractionDraft,
  niche?: string | null
): AifStructuredKnowledge {
  const normalized = runAifKnowledgeNormalizer(draft, niche);
  const withRules = ensureAifOperationalDecisionRules(normalized);
  const { draft: validated, report } = runAifKnowledgeValidator(withRules);
  const boosted = boostConfidenceAfterValidation(validated, report);
  const graph = buildAifKnowledgeGraph(boosted);
  return attachValidationToKnowledge(boosted, graph, report);
}

export async function runAifPipeline(input: AifPipelineInput): Promise<AifPipelineResult> {
  const importResult = await runAifImportPipeline(input);
  if (importResult.error || !importResult.rawText.trim()) {
    return {
      stage: "import",
      import: importResult,
      knowledge: null,
      expertSourceId: null,
      error: importResult.error ?? "Importação falhou.",
    };
  }

  // OOM guard: single-shot pipeline must not ingest huge transcripts in memory
  const { AIF_HARD_MAX_EXTRACT_CHARS } = await import("@/lib/aif/chunking");
  if (importResult.rawText.length > AIF_HARD_MAX_EXTRACT_CHARS) {
    console.warn("[aif] single-shot rejected — text too large; use AIF v2 queue", {
      contentLength: importResult.rawText.length,
      maxAllowed: AIF_HARD_MAX_EXTRACT_CHARS,
    });
    return {
      stage: "import",
      import: importResult,
      knowledge: null,
      expertSourceId: null,
      error: `Texto muito grande (${importResult.rawText.length} chars) para AIF single-shot. Use a fila incremental (AIF v2).`,
    };
  }

  console.info("[aif] single-shot extract", {
    contentLength: importResult.rawText.length,
    title: importResult.title,
  });

  const extraction = await runAifKnowledgeExtractor({
    rawText: importResult.rawText,
    title: importResult.title,
    author: input.author,
    niche: input.niche,
  });

  const knowledge = runAifProcessingStages(extraction, input.niche);

  if (countAifEntities(knowledge) === 0) {
    return {
      stage: "extract",
      import: importResult,
      knowledge,
      expertSourceId: null,
      error: "Nenhum conhecimento estruturado extraído.",
    };
  }

  const commit = await commitStructuredKnowledgeToExpertBrain({
    input: { ...input, title: importResult.title },
    rawText: importResult.rawText,
    knowledge,
  });

  if (commit.error || !commit.source) {
    return {
      stage: "commit",
      import: importResult,
      knowledge,
      expertSourceId: null,
      error: commit.error ?? "Falha ao gravar no Expert Brain.",
    };
  }

  return {
    stage: "commit",
    import: importResult,
    knowledge,
    expertSourceId: commit.source.id,
    error: null,
  };
}

export async function processAifTextIngest(input: AifPipelineInput): Promise<AifPipelineResult> {
  return runAifPipeline(input);
}

export async function getAifCeoExpertKnowledgeBlock(pergunta: string): Promise<string> {
  const { context, error } = await getExpertContext({ task: "scaling", module: "aura_ceo" });
  if (error || !context) return "";

  const structuredBlock = buildAifExpertContextBlock({
    task: context.task,
    frameworks: context.frameworks.map((f) => ({
      name: f.name,
      summary: f.summary,
      principles: f.principles,
    })),
    decisionRules: context.decisionRules.map((r) => ({
      name: r.name,
      rule: r.summary,
      whenToApply: r.rules?.[0] ?? "contexto estratégico",
    })),
    checklists: context.checklists.map((c) => ({
      name: c.name,
      items: c.steps ?? [],
    })),
  });

  if (/oferta|landing|copy|criativ|convers/i.test(pergunta)) {
    return `${structuredBlock}\n\n${buildAifCeoKnowledgeBlock({
      frameworks: context.frameworks.map((f) => ({
        id: f.id,
        type: "framework",
        name: f.name,
        category: f.category ?? "scaling",
        summary: f.summary,
        principles: f.principles ?? [],
        whenToUse: "",
        examples: [],
        confidence: { value: f.confidence ?? 70, reasons: [] },
      })),
      checklists: [],
      decisionRules: context.decisionRules.map((r) => ({
        id: r.id,
        type: "decision_rule",
        name: r.name,
        category: r.category ?? "scaling",
        summary: r.summary,
        rule: r.summary,
        whenToApply: r.rules?.[0] ?? "",
        whenNotToApply: "",
        priority: 50,
        confidence: { value: r.confidence ?? 70, reasons: [] },
      })),
      kpis: [],
      cases: [],
      principles: [],
      mentalModels: [],
      antiPatterns: [],
      concepts: [],
      graph: { nodes: [], edges: [] },
      validation: { passed: true, issues: [], deduplicatedCount: 0, averageConfidence: 70 },
    })}`;
  }

  return structuredBlock;
}

export async function getAifHealth(): Promise<{
  ok: boolean;
  version: string;
  stages: string[];
  supportedSources: string[];
}> {
  return {
    ok: true,
    version: "1.0.0",
    stages: [
      "import",
      "extract",
      "normalize",
      "validate",
      "graph",
      "decision_rules",
      "commit",
    ],
    supportedSources: ["pdf", "mp4", "docx", "txt", "zip", "google_drive", "youtube"],
  };
}

export type AifIngestAdapterResult = IngestKnowledgeSourceResult & {
  aifPipeline?: AifPipelineResult;
};

export async function ingestViaAif(input: AifPipelineInput): Promise<AifIngestAdapterResult> {
  const pipeline = await runAifPipeline(input);
  if (pipeline.error || !pipeline.expertSourceId) {
    return {
      source: null,
      frameworks: [],
      playbooks: [],
      patterns: [],
      decisionRules: [],
      checklists: [],
      failurePatterns: [],
      successPatterns: [],
      error: pipeline.error,
      aifPipeline: pipeline,
    };
  }

  return {
    source: null,
    frameworks: [],
    playbooks: [],
    patterns: [],
    decisionRules: [],
    checklists: [],
    failurePatterns: [],
    successPatterns: [],
    error: null,
    aifPipeline: pipeline,
  };
}
