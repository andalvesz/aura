import OpenAI from "openai";
import type {
  ExpertBrainCategory,
  ExpertFramework,
  ExpertKnowledgeSource,
  ExpertPattern,
  ExpertPlaybook,
  Json,
  TableInsert,
} from "@/types/database";
import {
  ExpertFrameworksRepository,
  ExpertKnowledgeSourcesRepository,
  ExpertPatternsRepository,
  ExpertPlaybooksRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import type { UnifiedDecision, UnifiedDecisionEngineResult, DecisionSource } from "@/utils/aura-decision-engine";
import { buildDecisionEngineAuraContext } from "@/utils/aura-decision-engine";
import { applyWinnerPatternToSystemPrompt } from "@/utils/winner-pattern";
import {
  applyExpertContextToPrompt,
  buildExpertContextPromptBlock,
  buildExcellenceCriteriaPromptBlock,
  collectExcellenceCriteria,
  emptyExpertContext,
  frameworkToContextItem,
  heuristicExtractFrameworks,
  heuristicExtractPatterns,
  heuristicExtractPlaybooks,
  logExpertContextInjected,
  patternAppliesToTask,
  patternToContextItem,
  playbookToContextItem,
  rankFrameworksForTask,
  readStringArray,
  resolveExpertTask,
  type ExpertContext,
  type ExpertContextFilters,
  type ExpertContextItem,
  type ExtractedFrameworkDraft,
  type ExtractedPatternDraft,
  type ExtractedPlaybookDraft,
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
};

export type IngestKnowledgeSourceResult = {
  source: ExpertKnowledgeSource | null;
  frameworks: ExpertFramework[];
  playbooks: ExpertPlaybook[];
  patterns: ExpertPattern[];
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

export async function ingestKnowledgeSource(
  input: IngestKnowledgeSourceInput
): Promise<IngestKnowledgeSourceResult> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      source: null,
      frameworks: [],
      playbooks: [],
      patterns: [],
      error: "Usuário não autenticado.",
    };
  }

  if (!input.title?.trim()) {
    return {
      source: null,
      frameworks: [],
      playbooks: [],
      patterns: [],
      error: "Informe o título.",
    };
  }

  if (!input.raw_text?.trim()) {
    return {
      source: null,
      frameworks: [],
      playbooks: [],
      patterns: [],
      error: "Informe o raw_text.",
    };
  }

  const sourcesRepo = new ExpertKnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const playbooksRepo = new ExpertPlaybooksRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new ExpertPatternsRepository(ctx.supabase, ctx.userId);

  const { data: source, error: createError } = await sourcesRepo.create({
    title: input.title.trim(),
    source_type: input.source_type,
    origin: input.origin?.trim() || null,
    author: input.author?.trim() || null,
    niche: input.niche?.trim() || null,
    status: "processing",
    metadata: {
      raw_text_length: input.raw_text.length,
      ingested_at: new Date().toISOString(),
    } as Json,
  } satisfies Omit<TableInsert<"expert_knowledge_sources">, "user_id">);

  if (createError || !source) {
    return {
      source: null,
      frameworks: [],
      playbooks: [],
      patterns: [],
      error: createError ?? "Erro ao salvar fonte.",
    };
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
    return { source, frameworks: [], playbooks: [], patterns: [], error: frameworksError };
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
    return { source, frameworks, playbooks: [], patterns: [], error: playbooksError };
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
    return { source, frameworks, playbooks, patterns: [], error: patternsError };
  }

  const { data: updatedSource } = await sourcesRepo.update(source.id, {
    status: "ready",
    metadata: {
      ...(typeof source.metadata === "object" && source.metadata ? source.metadata : {}),
      frameworks_count: frameworks.length,
      playbooks_count: playbooks.length,
      patterns_count: patterns.length,
      processed_at: new Date().toISOString(),
    } as Json,
  });

  console.info("[expert-brain] ingested", {
    sourceId: source.id,
    frameworks: frameworks.length,
    playbooks: playbooks.length,
    patterns: patterns.length,
  });

  return {
    source: updatedSource ?? source,
    frameworks,
    playbooks,
    patterns,
    error: null,
  };
}

async function loadExpertDataForTask(task: ExpertBrainCategory, niche?: string | null) {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      frameworks: [] as ExpertFramework[],
      playbooks: [] as ExpertPlaybook[],
      patterns: [] as ExpertPattern[],
      error: "Usuário não autenticado.",
    };
  }

  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const playbooksRepo = new ExpertPlaybooksRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new ExpertPatternsRepository(ctx.supabase, ctx.userId);

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
  const { data: playbooks } = await playbooksRepo.findByFrameworkIds(frameworkIds);

  const patterns = (allPatterns ?? [])
    .filter((pattern) => patternAppliesToTask(pattern, task))
    .slice(0, MAX_CONTEXT_ITEMS);

  return {
    frameworks: ranked,
    playbooks: (playbooks ?? []).slice(0, MAX_CONTEXT_ITEMS),
    patterns,
    error: null,
  };
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
  const { frameworks, playbooks, patterns, error } = await loadExpertDataForTask(
    task,
    filters.niche
  );

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
  const patterns = await getExpertDecisionPatterns();
  if (patterns.length === 0) return decisions;

  const expertDecisions = expertPatternsToDecisions(patterns);
  const sourcesUsed: DecisionSource[] = decisions.sourcesUsed.includes("expert_brain")
    ? decisions.sourcesUsed
    : [...decisions.sourcesUsed, "expert_brain"];

  const pickStronger = (
    current: UnifiedDecision | null,
    expert: UnifiedDecision
  ): UnifiedDecision => {
    if (!current || expert.score > current.score) return expert;
    return current;
  };

  let bestOffer = decisions.bestOffer;
  let bestCreative = decisions.bestCreative;
  let bestLanding = decisions.bestLanding;
  let bestProduct = decisions.bestProduct;

  for (const expert of expertDecisions) {
    const applies = readStringArray(
      (expert.metadata.applies_to as unknown) ?? []
    );
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

  return {
    ...decisions,
    bestOffer,
    bestCreative,
    bestLanding,
    bestProduct,
    sourcesUsed,
    confidence: Math.min(100, decisions.confidence + (expertDecisions.length > 0 ? 3 : 0)),
  };
}

export async function getExpertFrameworkCriteriaForAsset(
  assetCategory: ExpertBrainCategory
): Promise<string[]> {
  const { context } = await getExpertContext(assetCategory);
  return context.excellenceCriteria;
}

export type TransversalGenerationContext = {
  expertContext: ExpertContext;
  expertPromptBlock: string;
  decisionContext: UnifiedDecisionEngineResult | null;
  decisionPromptBlock: string;
  excellenceCriteria: string[];
  excellencePromptBlock: string;
  combinedAugmentation: string;
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

  return {
    expertContext,
    expertPromptBlock,
    decisionContext,
    decisionPromptBlock,
    excellenceCriteria,
    excellencePromptBlock,
    combinedAugmentation,
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
  error: string | null;
}> {
  const { context, error } = await getExpertContext(resolveExpertTask(task));
  return {
    frameworks: context.frameworks,
    playbooks: context.playbooks,
    patterns: context.patterns,
    error,
  };
}
