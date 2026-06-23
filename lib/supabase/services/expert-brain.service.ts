import OpenAI from "openai";
import type {
  ExpertBrainCategory,
  ExpertChecklist,
  ExpertDecisionRule,
  ExpertFailurePattern,
  ExpertFramework,
  ExpertKnowledgeSource,
  ExpertPattern,
  ExpertPlaybook,
  ExpertSuccessPattern,
  Json,
  TableInsert,
} from "@/types/database";
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
import type { UnifiedDecision, UnifiedDecisionEngineResult, DecisionSource } from "@/utils/aura-decision-engine";
import { buildDecisionEngineAuraContext } from "@/utils/aura-decision-engine";
import type { AppliedKnowledge } from "@/utils/knowledge-sources";
import type { ExpertInfluenceAudit } from "@/utils/expert-influence";
import { applyWinnerPatternToSystemPrompt } from "@/utils/winner-pattern";
import {
  applyExpertContextToPrompt,
  buildExpertContextPromptBlock,
  buildExpertMentorPromptBlock,
  buildExpertRiskAssessmentFromPatterns,
  buildExcellenceCriteriaPromptBlock,
  checklistToContextItem,
  collectExpertChecklistCriteria,
  collectExcellenceCriteria,
  decisionRuleToContextItem,
  emptyExpertContext,
  evaluateExpertOperationalChecklist,
  failurePatternToContextItem,
  frameworkToContextItem,
  heuristicExtractChecklists,
  heuristicExtractDecisionRules,
  heuristicExtractFailurePatterns,
  heuristicExtractFrameworks,
  heuristicExtractPatterns,
  heuristicExtractPlaybooks,
  heuristicExtractSuccessPatterns,
  logExpertContextInjected,
  patternAppliesToTask,
  patternToContextItem,
  playbookToContextItem,
  rankFrameworksForTask,
  readStringArray,
  resolveExpertTask,
  successPatternToContextItem,
  type ExpertContext,
  type ExpertContextFilters,
  type ExpertContextItem,
  type ExpertMentorContext,
  type ExpertOperationalChecklistResult,
  type ExpertRiskAssessment,
  type ExpertRiskAssessmentInput,
  type ExtractedChecklistDraft,
  type ExtractedDecisionRuleDraft,
  type ExtractedFailurePatternDraft,
  type ExtractedFrameworkDraft,
  type ExtractedPatternDraft,
  type ExtractedPlaybookDraft,
  type ExtractedSuccessPatternDraft,
} from "@/utils/expert-brain";
import { getOptionalDataContext } from "./context";
import { getUnifiedDecisionsReadOnly } from "./aura-decision-engine.service";

const MAX_CONTEXT_ITEMS = 5;

export type IngestKnowledgeSourceInput = {
  title: string;
  source_type: ExpertKnowledgeSource["source_type"];
  raw_text: string;
  author?: string | null;
  niche?: string | null;
  origin?: string | null;
  course_id?: string | null;
  module_id?: string | null;
  lesson_id?: string | null;
  existing_source_id?: string | null;
};

export type IngestKnowledgeSourceResult = {
  source: ExpertKnowledgeSource | null;
  frameworks: ExpertFramework[];
  playbooks: ExpertPlaybook[];
  patterns: ExpertPattern[];
  decisionRules: ExpertDecisionRule[];
  checklists: ExpertChecklist[];
  failurePatterns: ExpertFailurePattern[];
  successPatterns: ExpertSuccessPattern[];
  error: string | null;
};

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function callExpertBrainAi<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

function normalizeFrameworkDrafts(
  drafts: ExtractedFrameworkDraft[],
  fallbackNiche?: string | null
): ExtractedFrameworkDraft[] {
  return drafts
    .filter((draft) => draft.name?.trim())
    .map((draft) => ({
      name: draft.name.trim().slice(0, 160),
      category: draft.category ?? resolveExpertTask(null, "copylab"),
      description: draft.description?.trim() || draft.name,
      principles: (draft.principles ?? []).filter(Boolean).slice(0, 8),
      when_to_use: draft.when_to_use?.trim() || "Quando o contexto exigir este método.",
      examples: (draft.examples ?? []).filter(Boolean).slice(0, 5),
    }))
    .slice(0, 8)
    .map((draft) => ({
      ...draft,
      category: draft.category || inferCategoryFallback(fallbackNiche),
    }));
}

function inferCategoryFallback(niche?: string | null): ExpertBrainCategory {
  return heuristicExtractFrameworks(niche ?? "copy", niche)[0]?.category ?? "copywriting";
}

export async function extractFrameworks(params: {
  rawText: string;
  title?: string;
  niche?: string | null;
  author?: string | null;
}): Promise<{ frameworks: ExtractedFrameworkDraft[]; error: string | null }> {
  const rawText = params.rawText?.trim();
  if (!rawText) return { frameworks: [], error: "Texto vazio." };

  const ai = await callExpertBrainAi<{ frameworks: ExtractedFrameworkDraft[] }>(
    `Você é o Aura Expert Brain — transforma conteúdo educacional em frameworks acionáveis.
NÃO resuma o curso. Extraia métodos, princípios e quando usar.
Responda APENAS JSON:
{
  "frameworks": [{
    "name": "string",
    "category": "product_creation|copywriting|funnel_strategy|offer_creation|creative_strategy|paid_traffic|landing_page|sales_psychology|launch_strategy|retention|scaling",
    "description": "string",
    "principles": ["string"],
    "when_to_use": "string",
    "examples": ["string"]
  }]
}
Máximo 6 frameworks.`,
    JSON.stringify({
      title: params.title ?? "Material",
      author: params.author ?? null,
      niche: params.niche ?? null,
      raw_text: rawText.slice(0, 12000),
    })
  );

  if (ai?.frameworks?.length) {
    return {
      frameworks: normalizeFrameworkDrafts(ai.frameworks, params.niche),
      error: null,
    };
  }

  return {
    frameworks: normalizeFrameworkDrafts(heuristicExtractFrameworks(rawText, params.niche), params.niche),
    error: null,
  };
}

export async function extractPlaybooks(params: {
  frameworks: ExtractedFrameworkDraft[];
  rawText?: string;
}): Promise<{ playbooks: ExtractedPlaybookDraft[]; error: string | null }> {
  if (params.frameworks.length === 0) {
    return { playbooks: [], error: null };
  }

  const ai = await callExpertBrainAi<{ playbooks: ExtractedPlaybookDraft[] }>(
    `Você é o Aura Expert Brain — cria playbooks executáveis a partir de frameworks.
Responda APENAS JSON:
{
  "playbooks": [{
    "framework_name": "string",
    "playbook_type": "checklist|workflow|decision_tree|template|rules",
    "title": "string",
    "steps": ["string"],
    "rules": ["string"],
    "examples": ["string"]
  }]
}`,
    JSON.stringify({
      frameworks: params.frameworks,
      raw_text: params.rawText?.slice(0, 8000) ?? null,
    })
  );

  if (ai?.playbooks?.length) {
    return { playbooks: ai.playbooks.slice(0, 10), error: null };
  }

  return { playbooks: heuristicExtractPlaybooks(params.frameworks), error: null };
}

export async function extractExpertPatterns(params: {
  frameworks: ExtractedFrameworkDraft[];
  sourceId?: string;
  rawText?: string;
}): Promise<{ patterns: ExtractedPatternDraft[]; error: string | null }> {
  if (params.frameworks.length === 0) {
    return { patterns: [], error: null };
  }

  const ai = await callExpertBrainAi<{ patterns: ExtractedPatternDraft[] }>(
    `Você é o Aura Expert Brain — extrai padrões aplicáveis: regras de decisão, critérios de qualidade, checklists e heurísticas.
Responda APENAS JSON:
{
  "patterns": [{
    "pattern_type": "decision_rule|quality_criterion|checklist_item|heuristic|winner_signal",
    "title": "string",
    "description": "string",
    "applies_to": ["copywriting"],
    "confidence_score": 0-100
  }]
}`,
    JSON.stringify({
      frameworks: params.frameworks,
      source_id: params.sourceId ?? null,
      raw_text: params.rawText?.slice(0, 6000) ?? null,
    })
  );

  if (ai?.patterns?.length) {
    return { patterns: ai.patterns.slice(0, 15), error: null };
  }

  return {
    patterns: heuristicExtractPatterns(params.frameworks, params.sourceId),
    error: null,
  };
}

function normalizeDecisionRuleDrafts(
  drafts: ExtractedDecisionRuleDraft[],
  fallbackNiche?: string | null
): ExtractedDecisionRuleDraft[] {
  return drafts
    .filter((draft) => draft.title?.trim() && draft.rule?.trim())
    .map((draft) => ({
      ...draft,
      title: draft.title.trim().slice(0, 160),
      rule: draft.rule.trim().slice(0, 500),
      category: draft.category ?? inferCategoryFallback(fallbackNiche),
      when_to_apply: draft.when_to_apply?.trim() || "Quando o contexto exigir esta regra.",
      when_not_to_apply: draft.when_not_to_apply?.trim() || "Quando conflitar com dados de performance.",
      confidence_score: Math.min(100, Math.max(0, Number(draft.confidence_score ?? 70))),
      priority: Math.min(10, Math.max(0, Number(draft.priority ?? 3))),
    }))
    .slice(0, 12);
}

export async function extractDecisionRules(params: {
  frameworks: ExtractedFrameworkDraft[];
  sourceId?: string;
  rawText?: string;
}): Promise<{ rules: ExtractedDecisionRuleDraft[]; error: string | null }> {
  if (params.frameworks.length === 0) {
    return { rules: [], error: null };
  }

  const ai = await callExpertBrainAi<{ decision_rules: ExtractedDecisionRuleDraft[] }>(
    `Você é o Aura Expert Brain — extrai regras de decisão executáveis.
Responda APENAS JSON:
{
  "decision_rules": [{
    "framework_name": "string",
    "title": "string",
    "category": "product_creation|copywriting|funnel_strategy|offer_creation|creative_strategy|paid_traffic|landing_page|sales_psychology|launch_strategy|retention|scaling",
    "rule": "string",
    "when_to_apply": "string",
    "when_not_to_apply": "string",
    "confidence_score": 0-100,
    "priority": 0-10
  }]
}`,
    JSON.stringify({
      frameworks: params.frameworks,
      source_id: params.sourceId ?? null,
      raw_text: params.rawText?.slice(0, 6000) ?? null,
    })
  );

  if (ai?.decision_rules?.length) {
    return { rules: normalizeDecisionRuleDrafts(ai.decision_rules), error: null };
  }

  return { rules: normalizeDecisionRuleDrafts(heuristicExtractDecisionRules(params.frameworks)), error: null };
}

export async function extractChecklists(params: {
  frameworks: ExtractedFrameworkDraft[];
  rawText?: string;
}): Promise<{ checklists: ExtractedChecklistDraft[]; error: string | null }> {
  if (params.frameworks.length === 0) {
    return { checklists: [], error: null };
  }

  const ai = await callExpertBrainAi<{ checklists: ExtractedChecklistDraft[] }>(
    `Você é o Aura Expert Brain — extrai checklists operacionais.
Responda APENAS JSON:
{
  "checklists": [{
    "title": "string",
    "checklist_type": "operational|quality|launch|validation|scaling|other",
    "items": ["string"],
    "pass_criteria": "string"
  }]
}`,
    JSON.stringify({
      frameworks: params.frameworks,
      raw_text: params.rawText?.slice(0, 6000) ?? null,
    })
  );

  if (ai?.checklists?.length) {
    return { checklists: ai.checklists.slice(0, 8), error: null };
  }

  return { checklists: heuristicExtractChecklists(params.frameworks), error: null };
}

export async function extractFailurePatterns(params: {
  frameworks: ExtractedFrameworkDraft[];
  rawText?: string;
}): Promise<{ patterns: ExtractedFailurePatternDraft[]; error: string | null }> {
  if (params.frameworks.length === 0) {
    return { patterns: [], error: null };
  }

  const ai = await callExpertBrainAi<{ failure_patterns: ExtractedFailurePatternDraft[] }>(
    `Você é o Aura Expert Brain — extrai padrões de falha e erros comuns.
Responda APENAS JSON:
{
  "failure_patterns": [{
    "title": "string",
    "description": "string",
    "warning_signs": ["string"],
    "consequences": ["string"],
    "prevention_actions": ["string"]
  }]
}`,
    JSON.stringify({
      frameworks: params.frameworks,
      raw_text: params.rawText?.slice(0, 6000) ?? null,
    })
  );

  if (ai?.failure_patterns?.length) {
    return { patterns: ai.failure_patterns.slice(0, 8), error: null };
  }

  return { patterns: heuristicExtractFailurePatterns(params.frameworks), error: null };
}

export async function extractSuccessPatterns(params: {
  frameworks: ExtractedFrameworkDraft[];
  rawText?: string;
}): Promise<{ patterns: ExtractedSuccessPatternDraft[]; error: string | null }> {
  if (params.frameworks.length === 0) {
    return { patterns: [], error: null };
  }

  const ai = await callExpertBrainAi<{ success_patterns: ExtractedSuccessPatternDraft[] }>(
    `Você é o Aura Expert Brain — extrai padrões de sucesso replicáveis.
Responda APENAS JSON:
{
  "success_patterns": [{
    "title": "string",
    "description": "string",
    "success_signals": ["string"],
    "scaling_actions": ["string"]
  }]
}`,
    JSON.stringify({
      frameworks: params.frameworks,
      raw_text: params.rawText?.slice(0, 6000) ?? null,
    })
  );

  if (ai?.success_patterns?.length) {
    return { patterns: ai.success_patterns.slice(0, 8), error: null };
  }

  return { patterns: heuristicExtractSuccessPatterns(params.frameworks), error: null };
}

function emptyIngestResult(error: string): IngestKnowledgeSourceResult {
  return {
    source: null,
    frameworks: [],
    playbooks: [],
    patterns: [],
    decisionRules: [],
    checklists: [],
    failurePatterns: [],
    successPatterns: [],
    error,
  };
}

export async function ingestKnowledgeSource(
  input: IngestKnowledgeSourceInput
): Promise<IngestKnowledgeSourceResult> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return emptyIngestResult("Usuário não autenticado.");
  }

  if (!input.title?.trim()) {
    return emptyIngestResult("Informe o título.");
  }

  if (!input.raw_text?.trim()) {
    return emptyIngestResult("Informe o raw_text.");
  }

  const sourcesRepo = new ExpertKnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const playbooksRepo = new ExpertPlaybooksRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new ExpertPatternsRepository(ctx.supabase, ctx.userId);
  const decisionRulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const checklistsRepo = new ExpertChecklistsRepository(ctx.supabase, ctx.userId);
  const failurePatternsRepo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);
  const successPatternsRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);

  let source: ExpertKnowledgeSource | null = null;

  if (input.existing_source_id) {
    const { data: existingSource, error: loadError } = await sourcesRepo.findById(
      input.existing_source_id
    );
    if (loadError || !existingSource) {
      return emptyIngestResult(loadError ?? "Fonte não encontrada.");
    }
    const { error: clearError } = await clearSourceArtifacts(existingSource.id);
    if (clearError) return emptyIngestResult(clearError);

    const { data: updatedExisting } = await sourcesRepo.update(existingSource.id, {
      status: "processing",
      raw_text: input.raw_text,
      title: input.title.trim(),
      source_type: input.source_type,
      author: input.author?.trim() || existingSource.author,
      niche: input.niche?.trim() || existingSource.niche,
      metadata: {
        ...(typeof existingSource.metadata === "object" && existingSource.metadata
          ? existingSource.metadata
          : {}),
        raw_text_length: input.raw_text.length,
        reprocessed_at: new Date().toISOString(),
      } as Json,
    });
    source = updatedExisting ?? existingSource;
  } else {
    const { data: createdSource, error: createError } = await sourcesRepo.create({
      title: input.title.trim(),
      source_type: input.source_type,
      origin: input.origin?.trim() || null,
      author: input.author?.trim() || null,
      niche: input.niche?.trim() || null,
      raw_text: input.raw_text,
      course_id: input.course_id ?? null,
      module_id: input.module_id ?? null,
      lesson_id: input.lesson_id ?? null,
      status: "processing",
      metadata: {
        raw_text_length: input.raw_text.length,
        ingested_at: new Date().toISOString(),
      } as Json,
    } satisfies Omit<TableInsert<"expert_knowledge_sources">, "user_id">);

    if (createError || !createdSource) {
      return emptyIngestResult(createError ?? "Erro ao salvar fonte.");
    }
    source = createdSource;
  }

  if (!source) {
    return emptyIngestResult("Erro ao preparar fonte.");
  }

  const { frameworks: frameworkDrafts } = await extractFrameworks({
    rawText: input.raw_text,
    title: input.title,
    niche: input.niche,
    author: input.author,
  });

  const frameworkRows = frameworkDrafts.map(
    (draft) =>
      ({
        source_id: source.id,
        name: draft.name,
        category: draft.category,
        description: draft.description,
        principles: draft.principles as unknown as Json,
        when_to_use: draft.when_to_use,
        examples: draft.examples as unknown as Json,
        metadata: { niche: input.niche ?? null } as Json,
      }) satisfies Omit<TableInsert<"expert_frameworks">, "user_id">
  );

  const { data: frameworks, error: frameworksError } = await frameworksRepo.createMany(frameworkRows);
  if (frameworksError) {
    await sourcesRepo.update(source.id, { status: "failed" });
    return { ...emptyIngestResult(frameworksError), source };
  }

  const { playbooks: playbookDrafts } = await extractPlaybooks({
    frameworks: frameworkDrafts,
    rawText: input.raw_text,
  });

  const frameworkByName = new Map(frameworks.map((f) => [f.name.toLowerCase(), f.id]));
  const playbookRows = playbookDrafts.map((draft) => {
    const frameworkId =
      frameworkByName.get(draft.framework_name.toLowerCase()) ?? frameworks[0]?.id ?? null;
    return {
      framework_id: frameworkId,
      playbook_type: draft.playbook_type,
      title: draft.title,
      steps: draft.steps as unknown as Json,
      rules: draft.rules as unknown as Json,
      examples: draft.examples as unknown as Json,
      metadata: {} as Json,
    } satisfies Omit<TableInsert<"expert_playbooks">, "user_id">;
  });

  const { data: playbooks, error: playbooksError } = await playbooksRepo.createMany(playbookRows);
  if (playbooksError) {
    await sourcesRepo.update(source.id, { status: "failed" });
    return { ...emptyIngestResult(playbooksError), source, frameworks };
  }

  const { patterns: patternDrafts } = await extractExpertPatterns({
    frameworks: frameworkDrafts,
    sourceId: source.id,
    rawText: input.raw_text,
  });

  const patternRows = patternDrafts.map(
    (draft) =>
      ({
        pattern_type: draft.pattern_type,
        title: draft.title,
        description: draft.description,
        applies_to: draft.applies_to as unknown as Json,
        confidence_score: draft.confidence_score,
        source_ids: [source.id] as unknown as Json,
        metadata: {} as Json,
      }) satisfies Omit<TableInsert<"expert_patterns">, "user_id">
  );

  const { data: patterns, error: patternsError } = await patternsRepo.createMany(patternRows);
  if (patternsError) {
    await sourcesRepo.update(source.id, { status: "failed" });
    return { ...emptyIngestResult(patternsError), source, frameworks, playbooks };
  }

  const { rules: decisionRuleDrafts } = await extractDecisionRules({
    frameworks: frameworkDrafts,
    sourceId: source.id,
    rawText: input.raw_text,
  });

  const decisionRuleRows = decisionRuleDrafts.map((draft) => {
    const frameworkId =
      frameworkByName.get(draft.framework_name.toLowerCase()) ?? frameworks[0]?.id ?? null;
    return {
      source_id: source.id,
      framework_id: frameworkId,
      title: draft.title,
      category: draft.category,
      rule: draft.rule,
      when_to_apply: draft.when_to_apply,
      when_not_to_apply: draft.when_not_to_apply,
      confidence_score: draft.confidence_score,
      priority: draft.priority,
      metadata: {} as Json,
    } satisfies Omit<TableInsert<"expert_decision_rules">, "user_id">;
  });

  const { data: decisionRules, error: decisionRulesError } =
    await decisionRulesRepo.createMany(decisionRuleRows);
  if (decisionRulesError) {
    await sourcesRepo.update(source.id, { status: "failed" });
    return { ...emptyIngestResult(decisionRulesError), source, frameworks, playbooks, patterns };
  }

  const { checklists: checklistDrafts } = await extractChecklists({
    frameworks: frameworkDrafts,
    rawText: input.raw_text,
  });

  const checklistRows = checklistDrafts.map(
    (draft) =>
      ({
        source_id: source.id,
        title: draft.title,
        checklist_type: draft.checklist_type,
        items: draft.items as unknown as Json,
        pass_criteria: draft.pass_criteria,
        metadata: {} as Json,
      }) satisfies Omit<TableInsert<"expert_checklists">, "user_id">
  );

  const { data: checklists, error: checklistsError } =
    await checklistsRepo.createMany(checklistRows);
  if (checklistsError) {
    await sourcesRepo.update(source.id, { status: "failed" });
    return {
      ...emptyIngestResult(checklistsError),
      source,
      frameworks,
      playbooks,
      patterns,
      decisionRules,
    };
  }

  const { patterns: failureDrafts } = await extractFailurePatterns({
    frameworks: frameworkDrafts,
    rawText: input.raw_text,
  });

  const failurePatternRows = failureDrafts.map(
    (draft) =>
      ({
        source_id: source.id,
        title: draft.title,
        description: draft.description,
        warning_signs: draft.warning_signs as unknown as Json,
        consequences: draft.consequences as unknown as Json,
        prevention_actions: draft.prevention_actions as unknown as Json,
        metadata: {} as Json,
      }) satisfies Omit<TableInsert<"expert_failure_patterns">, "user_id">
  );

  const { data: failurePatterns, error: failurePatternsError } =
    await failurePatternsRepo.createMany(failurePatternRows);
  if (failurePatternsError) {
    await sourcesRepo.update(source.id, { status: "failed" });
    return {
      ...emptyIngestResult(failurePatternsError),
      source,
      frameworks,
      playbooks,
      patterns,
      decisionRules,
      checklists,
    };
  }

  const { patterns: successDrafts } = await extractSuccessPatterns({
    frameworks: frameworkDrafts,
    rawText: input.raw_text,
  });

  const successPatternRows = successDrafts.map(
    (draft) =>
      ({
        source_id: source.id,
        title: draft.title,
        description: draft.description,
        success_signals: draft.success_signals as unknown as Json,
        scaling_actions: draft.scaling_actions as unknown as Json,
        metadata: {} as Json,
      }) satisfies Omit<TableInsert<"expert_success_patterns">, "user_id">
  );

  const { data: successPatterns, error: successPatternsError } =
    await successPatternsRepo.createMany(successPatternRows);
  if (successPatternsError) {
    await sourcesRepo.update(source.id, { status: "failed" });
    return {
      ...emptyIngestResult(successPatternsError),
      source,
      frameworks,
      playbooks,
      patterns,
      decisionRules,
      checklists,
      failurePatterns,
    };
  }

  const { data: updatedSource } = await sourcesRepo.update(source.id, {
    status: "ready",
    metadata: {
      ...(typeof source.metadata === "object" && source.metadata ? source.metadata : {}),
      frameworks_count: frameworks.length,
      playbooks_count: playbooks.length,
      patterns_count: patterns.length,
      decision_rules_count: decisionRules.length,
      checklists_count: checklists.length,
      failure_patterns_count: failurePatterns.length,
      success_patterns_count: successPatterns.length,
      processed_at: new Date().toISOString(),
    } as Json,
  });

  console.info("[expert-brain] ingested", {
    sourceId: source.id,
    frameworks: frameworks.length,
    playbooks: playbooks.length,
    patterns: patterns.length,
    decisionRules: decisionRules.length,
    checklists: checklists.length,
    failurePatterns: failurePatterns.length,
    successPatterns: successPatterns.length,
  });

  return {
    source: updatedSource ?? source,
    frameworks,
    playbooks,
    patterns,
    decisionRules,
    checklists,
    failurePatterns,
    successPatterns,
    error: null,
  };
}

export async function clearSourceArtifacts(sourceId: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const playbooksRepo = new ExpertPlaybooksRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new ExpertPatternsRepository(ctx.supabase, ctx.userId);
  const decisionRulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const checklistsRepo = new ExpertChecklistsRepository(ctx.supabase, ctx.userId);
  const failurePatternsRepo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);
  const successPatternsRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);

  const { data: frameworks } = await frameworksRepo.findBySourceId(sourceId);
  const frameworkIds = (frameworks ?? []).map((f) => f.id);

  const steps = [
    () => playbooksRepo.deleteByFrameworkIds(frameworkIds),
    () => frameworksRepo.deleteBySourceId(sourceId),
    () => patternsRepo.deleteBySourceId(sourceId),
    () => decisionRulesRepo.deleteBySourceId(sourceId),
    () => checklistsRepo.deleteBySourceId(sourceId),
    () => failurePatternsRepo.deleteBySourceId(sourceId),
    () => successPatternsRepo.deleteBySourceId(sourceId),
  ];

  for (const step of steps) {
    const { error } = await step();
    if (error) return { error };
  }

  return { error: null };
}

export async function reprocessKnowledgeSource(
  sourceId: string
): Promise<IngestKnowledgeSourceResult> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return emptyIngestResult("Usuário não autenticado.");

  const sourcesRepo = new ExpertKnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const { data: source, error: loadError } = await sourcesRepo.findById(sourceId);
  if (loadError || !source) return emptyIngestResult(loadError ?? "Fonte não encontrada.");

  const rawText = source.raw_text?.trim();
  if (!rawText) {
    return emptyIngestResult("Texto original não disponível para reprocessamento.");
  }

  return ingestKnowledgeSource({
    title: source.title,
    source_type: source.source_type,
    raw_text: rawText,
    author: source.author,
    niche: source.niche,
    origin: source.origin,
    course_id: source.course_id,
    module_id: source.module_id,
    lesson_id: source.lesson_id,
    existing_source_id: source.id,
  });
}

async function loadExpertDataForTask(task: ExpertBrainCategory, niche?: string | null) {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      frameworks: [] as ExpertFramework[],
      playbooks: [] as ExpertPlaybook[],
      patterns: [] as ExpertPattern[],
      decisionRules: [] as ExpertDecisionRule[],
      checklists: [] as ExpertChecklist[],
      failurePatterns: [] as ExpertFailurePattern[],
      successPatterns: [] as ExpertSuccessPattern[],
      error: "Usuário não autenticado.",
    };
  }

  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const playbooksRepo = new ExpertPlaybooksRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new ExpertPatternsRepository(ctx.supabase, ctx.userId);
  const decisionRulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const checklistsRepo = new ExpertChecklistsRepository(ctx.supabase, ctx.userId);
  const failurePatternsRepo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);
  const successPatternsRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);

  const [{ data: categoryFrameworks }, { data: allFrameworks }, { data: allPatterns }] =
    await Promise.all([
      frameworksRepo.findByCategory(task, 20),
      frameworksRepo.findAll(),
      patternsRepo.findTop(40),
    ]);

  const ranked = rankFrameworksForTask(
    categoryFrameworks?.length ? categoryFrameworks : allFrameworks ?? [],
    task,
    niche
  ).slice(0, MAX_CONTEXT_ITEMS);

  const frameworkIds = ranked.map((f) => f.id);
  const [
    { data: playbooksData },
    { data: decisionRulesData },
    { data: checklistsData },
    { data: failurePatternsData },
    { data: successPatternsData },
  ] = await Promise.all([
    playbooksRepo.findByFrameworkIds(frameworkIds),
    decisionRulesRepo.findByCategory(task, MAX_CONTEXT_ITEMS),
    checklistsRepo.findRecent(MAX_CONTEXT_ITEMS * 2),
    failurePatternsRepo.findRecent(MAX_CONTEXT_ITEMS),
    successPatternsRepo.findRecent(MAX_CONTEXT_ITEMS),
  ]);

  const patternsFiltered = (allPatterns ?? [])
    .filter((pattern) => patternAppliesToTask(pattern, task))
    .slice(0, MAX_CONTEXT_ITEMS);

  const checklistsFiltered = (checklistsData ?? []).filter((checklist) => {
    const meta =
      typeof checklist.metadata === "object" && checklist.metadata ? checklist.metadata : {};
    const categories = readStringArray((meta as { categories?: unknown }).categories);
    if (categories.length === 0) return true;
    return categories.includes(task);
  });

  return {
    frameworks: ranked,
    playbooks: (playbooksData ?? []).slice(0, MAX_CONTEXT_ITEMS),
    patterns: patternsFiltered,
    decisionRules: (decisionRulesData ?? []).slice(0, MAX_CONTEXT_ITEMS),
    checklists: checklistsFiltered.slice(0, MAX_CONTEXT_ITEMS),
    failurePatterns: (failurePatternsData ?? []).slice(0, MAX_CONTEXT_ITEMS),
    successPatterns: (successPatternsData ?? []).slice(0, MAX_CONTEXT_ITEMS),
    error: null,
  };
}

export async function getDecisionRulesForTask(task: ExpertBrainCategory): Promise<{
  rules: ExpertDecisionRule[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { rules: [], error: "Usuário não autenticado." };

  const repo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findByCategory(task, MAX_CONTEXT_ITEMS);
  return { rules: data ?? [], error };
}

export async function getChecklistsForTask(task: ExpertBrainCategory): Promise<{
  checklists: ExpertChecklist[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { checklists: [], error: "Usuário não autenticado." };

  const repo = new ExpertChecklistsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findRecent(MAX_CONTEXT_ITEMS * 2);
  const checklists = (data ?? []).filter((checklist) => {
    const meta =
      typeof checklist.metadata === "object" && checklist.metadata ? checklist.metadata : {};
    const categories = readStringArray((meta as { categories?: unknown }).categories);
    if (categories.length === 0) return true;
    return categories.includes(task);
  });
  return { checklists: checklists.slice(0, MAX_CONTEXT_ITEMS), error };
}

export async function getFailurePatternsForTask(_task: ExpertBrainCategory): Promise<{
  patterns: ExpertFailurePattern[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { patterns: [], error: "Usuário não autenticado." };

  const repo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findRecent(MAX_CONTEXT_ITEMS);
  return { patterns: data ?? [], error };
}

export async function getSuccessPatternsForTask(_task: ExpertBrainCategory): Promise<{
  patterns: ExpertSuccessPattern[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { patterns: [], error: "Usuário não autenticado." };

  const repo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findRecent(MAX_CONTEXT_ITEMS);
  return { patterns: data ?? [], error };
}

export async function getExpertContext(
  taskOrFilters?: ExpertBrainCategory | ExpertContextFilters
): Promise<{
  context: ExpertContext;
  promptBlock: string;
  error: string | null;
}> {
  const filters: ExpertContextFilters =
    typeof taskOrFilters === "string" ? { task: taskOrFilters } : (taskOrFilters ?? {});

  const task = resolveExpertTask(filters.task, filters.module);
  const {
    frameworks,
    playbooks,
    patterns,
    decisionRules,
    checklists,
    failurePatterns,
    successPatterns,
    error,
  } = await loadExpertDataForTask(task, filters.niche);

  if (error) {
    return { context: emptyExpertContext(task), promptBlock: "", error };
  }

  const frameworkItems = frameworks.map(frameworkToContextItem);
  const appliedFrameworks = frameworkItems.map((f) => f.name);
  const excellenceCriteria = collectExcellenceCriteria(frameworkItems);

  const context: ExpertContext = {
    task,
    frameworks: frameworkItems,
    playbooks: playbooks.map(playbookToContextItem),
    patterns: patterns.map(patternToContextItem),
    decisionRules: decisionRules.map(decisionRuleToContextItem),
    checklists: checklists.map(checklistToContextItem),
    failurePatterns: failurePatterns.map(failurePatternToContextItem),
    successPatterns: successPatterns.map(successPatternToContextItem),
    appliedFrameworks,
    excellenceCriteria,
  };

  const promptBlock = buildExpertContextPromptBlock(context);
  logExpertContextInjected(filters.module ?? task, context);

  return { context, promptBlock, error: null };
}

export { rankFrameworksForTask, applyExpertContextToPrompt };

export async function getExpertDecisionPatterns(): Promise<ExpertPattern[]> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  const patternsRepo = new ExpertPatternsRepository(ctx.supabase, ctx.userId);
  const [{ data: decisionRules }, { data: heuristics }] = await Promise.all([
    patternsRepo.findByType("decision_rule", 10),
    patternsRepo.findByType("heuristic", 10),
  ]);

  return [...(decisionRules ?? []), ...(heuristics ?? [])].slice(0, 12);
}

export function expertDecisionRulesToDecisions(rules: ExpertDecisionRule[]): UnifiedDecision[] {
  const results: UnifiedDecision[] = [];

  for (const rule of rules) {
    const label = rule.title?.trim();
    if (!label) continue;
    const boostedScore = Math.min(
      100,
      Number(rule.confidence_score ?? 0) + Number(rule.priority ?? 0) * 2 + 8
    );
    results.push({
      label,
      score: boostedScore,
      source: "expert_brain",
      reason: rule.rule?.trim() || "Regra expert aplicável",
      entityId: rule.id,
      metadata: {
        rule_type: "expert_decision_rule",
        category: rule.category,
        when_to_apply: rule.when_to_apply,
      },
    });
  }

  return results;
}

export async function getExpertSuccessPatternsForWinnerContext(): Promise<ExpertSuccessPattern[]> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  const repo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);
  const { data } = await repo.findRecent(12);
  return data ?? [];
}

export async function getExpertPatternsForWinnerContext(): Promise<ExpertPattern[]> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  const patternsRepo = new ExpertPatternsRepository(ctx.supabase, ctx.userId);
  const [{ data: winnerSignals }, { data: heuristics }, { data: quality }] = await Promise.all([
    patternsRepo.findByType("winner_signal", 8),
    patternsRepo.findByType("heuristic", 8),
    patternsRepo.findByType("quality_criterion", 8),
  ]);

  return [...(winnerSignals ?? []), ...(heuristics ?? []), ...(quality ?? [])].slice(0, 15);
}

export function expertPatternsToDecisions(patterns: ExpertPattern[]): UnifiedDecision[] {
  const results: UnifiedDecision[] = [];

  for (const pattern of patterns) {
    const label = pattern.title?.trim();
    if (!label) continue;
    results.push({
      label,
      score: Number(pattern.confidence_score ?? 0),
      source: "expert_brain",
      reason: pattern.description?.trim() || "Padrão expert aplicável",
      entityId: pattern.id,
      metadata: {
        pattern_type: pattern.pattern_type,
        applies_to: readStringArray(pattern.applies_to),
      },
    });
  }

  return results;
}

export async function enrichDecisionsWithExpertPatterns(
  decisions: UnifiedDecisionEngineResult
): Promise<UnifiedDecisionEngineResult> {
  const [patterns, topRules] = await Promise.all([
    getExpertDecisionPatterns(),
    (async () => {
      const ctx = await getOptionalDataContext();
      if (!ctx) return [];
      const repo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findTop(12);
      return data ?? [];
    })(),
  ]);

  const expertDecisions = [
    ...expertDecisionRulesToDecisions(topRules),
    ...expertPatternsToDecisions(patterns),
  ];

  if (expertDecisions.length === 0) return decisions;

  const sourcesUsed: DecisionSource[] = decisions.sourcesUsed.includes("expert_brain")
    ? decisions.sourcesUsed
    : [...decisions.sourcesUsed, "expert_brain"];

  const pickStronger = (
    current: UnifiedDecision | null,
    expert: UnifiedDecision
  ): UnifiedDecision => {
    if (!current) return expert;
    if (expert.source === "expert_brain" && expert.score >= current.score) return expert;
    if (expert.score > current.score) return expert;
    return current;
  };

  let bestOffer = decisions.bestOffer;
  let bestCreative = decisions.bestCreative;
  let bestLanding = decisions.bestLanding;
  let bestProduct = decisions.bestProduct;

  for (const expert of expertDecisions) {
    const appliesFromPattern = readStringArray(
      (expert.metadata.applies_to as unknown) ?? []
    );
    const category =
      typeof expert.metadata.category === "string" ? expert.metadata.category : null;
    const applies = category ? [category, ...appliesFromPattern] : appliesFromPattern;

    if (applies.includes("offer_creation")) {
      bestOffer = pickStronger(bestOffer, expert);
    }
    if (applies.includes("creative_strategy") || applies.includes("paid_traffic")) {
      bestCreative = pickStronger(bestCreative, expert);
    }
    if (applies.includes("landing_page")) {
      bestLanding = pickStronger(bestLanding, expert);
    }
    if (applies.includes("product_creation")) {
      bestProduct = pickStronger(bestProduct, expert);
    }
  }

  const expertAlignedCount = [bestOffer, bestCreative, bestLanding, bestProduct].filter(
    (decision) => decision?.source === "expert_brain"
  ).length;

  return {
    ...decisions,
    bestOffer,
    bestCreative,
    bestLanding,
    bestProduct,
    sourcesUsed,
    confidence: Math.min(
      100,
      decisions.confidence + (expertDecisions.length > 0 ? 3 : 0) + expertAlignedCount * 2
    ),
  };
}

export async function getExpertFrameworkCriteriaForAsset(
  assetCategory: ExpertBrainCategory
): Promise<string[]> {
  const { context } = await getExpertContext(assetCategory);
  const { checklists } = await getChecklistsForTask(assetCategory);
  return [
    ...context.excellenceCriteria,
    ...collectExpertChecklistCriteria(checklists),
  ].slice(0, 16);
}

export async function getExpertChecklistCriteriaForAsset(
  assetCategory: ExpertBrainCategory
): Promise<string[]> {
  const { checklists } = await getChecklistsForTask(assetCategory);
  return collectExpertChecklistCriteria(
    checklists.filter((checklist) => checklist.checklist_type === "quality" || checklist.checklist_type === "validation")
  );
}

export async function buildExpertRiskAssessment(
  input: ExpertRiskAssessmentInput
): Promise<ExpertRiskAssessment> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { risks: [], failurePatterns: [], preventionActions: [], riskScore: 0 };
  }

  const repo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);
  const { data } = await repo.findRecent(20);
  return buildExpertRiskAssessmentFromPatterns(input, data ?? []);
}

export async function getExpertMentorContext(
  task: ExpertBrainCategory = "scaling"
): Promise<ExpertMentorContext> {
  const { context } = await getExpertContext(task);
  const mentorContext: ExpertMentorContext = {
    frameworks: context.frameworks.slice(0, 3),
    decisionRules: context.decisionRules.slice(0, 3),
    checklists: context.checklists.slice(0, 2),
    promptBlock: "",
  };
  mentorContext.promptBlock = buildExpertMentorPromptBlock(mentorContext);
  return mentorContext;
}

export async function validateExpertOperationalChecklists(
  steps: Record<string, "pending" | "in_progress" | "done">
): Promise<{
  results: ExpertOperationalChecklistResult[];
  blockedItems: string[];
  canApprove: boolean;
}> {
  const { checklists } = await getChecklistsForTask("scaling");
  const operational = checklists.filter(
    (checklist) =>
      checklist.checklist_type === "operational" ||
      (typeof checklist.metadata === "object" &&
        checklist.metadata &&
        (checklist.metadata as { critical?: boolean }).critical === true)
  );

  const results = operational.map((checklist) => evaluateExpertOperationalChecklist(checklist, steps));
  const blockedItems = results
    .filter((result) => result.critical && !result.passed)
    .flatMap((result) => result.failedItems.map((item) => `${result.checklist.name}: ${item}`));

  return {
    results,
    blockedItems,
    canApprove: blockedItems.length === 0,
  };
}

export type TransversalGenerationContext = {
  expertContext: ExpertContext;
  expertPromptBlock: string;
  decisionContext: UnifiedDecisionEngineResult | null;
  decisionPromptBlock: string;
  excellenceCriteria: string[];
  excellencePromptBlock: string;
  combinedAugmentation: string;
  appliedKnowledge: AppliedKnowledge;
  influenceAudit: ExpertInfluenceAudit;
};

export async function buildTransversalGenerationContext(params: {
  task: ExpertBrainCategory;
  module: string;
  niche?: string | null;
  winnerPromptBlock?: string;
}): Promise<TransversalGenerationContext> {
  const [{ context: expertContext, promptBlock: expertPromptBlock }, decisionsReadOnly] =
    await Promise.all([getExpertContext({ task: params.task, module: params.module, niche: params.niche }), getUnifiedDecisionsReadOnly()]);

  const decisionContext = decisionsReadOnly.decisions
    ? await enrichDecisionsWithExpertPatterns(decisionsReadOnly.decisions)
    : null;

  const decisionPromptBlock = decisionContext
    ? buildDecisionEngineAuraContext(decisionContext)
    : "";

  const excellenceCriteria = expertContext.excellenceCriteria;
  const excellencePromptBlock = buildExcellenceCriteriaPromptBlock(excellenceCriteria);

  const combinedAugmentation = [
    expertPromptBlock.trim(),
    decisionPromptBlock.trim(),
    excellencePromptBlock.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const promptApplied = Boolean(combinedAugmentation.trim());
  const recorded = await import("./expert-influence.service").then(({ recordExpertInfluence }) =>
    recordExpertInfluence({
      moduleName: params.module,
      context: expertContext,
      promptApplied,
    })
  );
  const { appliedKnowledge, ...influenceAudit } = recorded;

  return {
    expertContext,
    expertPromptBlock,
    decisionContext,
    decisionPromptBlock,
    excellenceCriteria,
    excellencePromptBlock,
    combinedAugmentation,
    appliedKnowledge,
    influenceAudit,
  };
}

export function augmentGeneratorSystemPrompt(
  baseSystem: string,
  module: string,
  transversal: TransversalGenerationContext,
  winnerPromptBlock?: string
): string {
  let system = baseSystem;
  if (winnerPromptBlock?.trim()) {
    system = applyWinnerPatternToSystemPrompt(system, winnerPromptBlock, module);
  }
  if (transversal.combinedAugmentation.trim()) {
    system = applyExpertContextToPrompt(system, transversal.combinedAugmentation, module);
  }
  return system;
}

export async function getExpertContextForApi(task: string): Promise<{
  frameworks: ExpertContextItem[];
  playbooks: ExpertContextItem[];
  patterns: ExpertContextItem[];
  decisionRules: ExpertContextItem[];
  checklists: ExpertContextItem[];
  failurePatterns: ExpertContextItem[];
  successPatterns: ExpertContextItem[];
  error: string | null;
}> {
  const { context, error } = await getExpertContext(resolveExpertTask(task));
  return {
    frameworks: context.frameworks,
    playbooks: context.playbooks,
    patterns: context.patterns,
    decisionRules: context.decisionRules,
    checklists: context.checklists,
    failurePatterns: context.failurePatterns,
    successPatterns: context.successPatterns,
    error,
  };
}
