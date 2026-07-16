import type {
  ExpertBrainCategory,
  ExpertCourse,
  ExpertCourseLesson,
  ExpertCourseModule,
  ExpertCourseStatus,
  ExpertDecisionRule,
  ExpertFailurePattern,
  ExpertFramework,
  ExpertIngestionQueueItem,
  ExpertLessonStatus,
  ExpertProcessingQueueItem,
  ExpertSuccessPattern,
  ExpertTranscript,
} from "@/types/database";
import { EXPERT_BRAIN_CATEGORY_LABELS } from "@/utils/expert-brain";
import {
  bucketForItem as smBucketForItem,
  countBuckets as smCountBuckets,
  deriveQueueMetrics as smDeriveQueueMetrics,
  type IngestionBucket,
  type IngestionBucketCounts,
} from "@/utils/expert-brain-state-machine";

export type ExpertBrainStatusCounts = {
  pending: number;
  processing: number;
  ready: number;
  failed: number;
  partial: number;
};

export type ExpertBrainLessonSummary = {
  id: string;
  title: string;
  status: ExpertLessonStatus;
  sourceType: string;
  sourceId: string | null;
  fileName: string | null;
  transcriptId: string | null;
};

export type ExpertBrainModuleSummary = {
  id: string;
  title: string;
  status: ExpertCourseStatus;
  sortOrder: number;
  lessons: ExpertBrainLessonSummary[];
  statusCounts: ExpertBrainStatusCounts;
};

export type ExpertBrainCourseSummary = {
  id: string;
  title: string;
  author: string | null;
  niche: string | null;
  status: ExpertCourseStatus;
  modules: ExpertBrainModuleSummary[];
  statusCounts: ExpertBrainStatusCounts;
};

export type ExpertBrainArtifactSummary = {
  id: string;
  title: string;
  category?: ExpertBrainCategory;
  categoryLabel?: string;
  sourceId?: string | null;
  confidence?: number;
  createdAt: string;
};

export type ExpertBrainIngestionBucket = IngestionBucket;

export type ExpertBrainIngestionBucketCounts = IngestionBucketCounts;

export type ExpertBrainDashboard = {
  metrics: {
    courses: number;
    modules: number;
    lessons: number;
    sourcesReady: number;
    queuePending: number;
    queueProcessing: number;
    frameworks: number;
    decisionRules: number;
    successPatterns: number;
    failurePatterns: number;
  };
  statusCounts: ExpertBrainStatusCounts;
  ingestionBuckets: ExpertBrainIngestionBucketCounts;
  driveConnection: {
    connected: boolean;
    expired: boolean;
    needsReconnect: boolean;
    email: string | null;
    accountName: string | null;
    lastError: string | null;
  };
  courses: ExpertBrainCourseSummary[];
  queue: ExpertProcessingQueueItem[];
  ingestionQueue: ExpertIngestionQueueItem[];
  transcripts: ExpertTranscript[];
  frameworks: ExpertBrainArtifactSummary[];
  decisionRules: ExpertBrainArtifactSummary[];
  successPatterns: ExpertBrainArtifactSummary[];
  failurePatterns: ExpertBrainArtifactSummary[];
};

export type ExpertBrainDashboardQueryWarning = {
  table: string;
  error: string;
  code?: string;
  message: string;
};

export function emptyExpertBrainDashboard(): ExpertBrainDashboard {
  return {
    metrics: {
      courses: 0,
      modules: 0,
      lessons: 0,
      sourcesReady: 0,
      queuePending: 0,
      queueProcessing: 0,
      frameworks: 0,
      decisionRules: 0,
      successPatterns: 0,
      failurePatterns: 0,
    },
    statusCounts: emptyExpertStatusCounts(),
    ingestionBuckets: emptyIngestionBucketCounts(),
    driveConnection: {
      connected: false,
      expired: false,
      needsReconnect: false,
      email: null,
      accountName: null,
      lastError: null,
    },
    courses: [],
    queue: [],
    ingestionQueue: [],
    transcripts: [],
    frameworks: [],
    decisionRules: [],
    successPatterns: [],
    failurePatterns: [],
  };
}

export function emptyIngestionBucketCounts(): ExpertBrainIngestionBucketCounts {
  return {
    pending: 0,
    processing: 0,
    waiting_oauth: 0,
    waiting_whisper: 0,
    completed: 0,
    failed: 0,
  };
}

export function emptyExpertStatusCounts(): ExpertBrainStatusCounts {
  return { pending: 0, processing: 0, ready: 0, failed: 0, partial: 0 };
}

export function ingestionBucketLabel(bucket: ExpertBrainIngestionBucket): string {
  const labels: Record<ExpertBrainIngestionBucket, string> = {
    pending: "Pending",
    processing: "Processing",
    waiting_oauth: "Waiting OAuth",
    waiting_whisper: "Waiting Whisper",
    completed: "Completed",
    failed: "Failed",
  };
  return labels[bucket];
}

export function bucketForIngestionItem(
  item: Pick<ExpertIngestionQueueItem, "status" | "last_error" | "error"> & {
    lease_until?: string | null;
  },
  driveNeedsReconnect: boolean
): ExpertBrainIngestionBucket {
  return smBucketForItem(item, { driveConnectionExpired: driveNeedsReconnect });
}

export function countIngestionBuckets(
  items: Array<
    Pick<ExpertIngestionQueueItem, "status" | "last_error" | "error"> & {
      lease_until?: string | null;
    }
  >,
  driveNeedsReconnect: boolean
): ExpertBrainIngestionBucketCounts {
  return smCountBuckets(items, { driveConnectionExpired: driveNeedsReconnect });
}

/**
 * Derive the two summary numbers (queuePending / queueProcessing) from the
 * mutually-exclusive ingestion buckets. Guarantees no item is counted twice.
 */
export function deriveQueueMetricsFromBuckets(
  counts: ExpertBrainIngestionBucketCounts
): { queuePending: number; queueProcessing: number } {
  return smDeriveQueueMetrics(counts);
}

export function countByStatus<T extends { status: string }>(items: T[]): ExpertBrainStatusCounts {
  const counts = emptyExpertStatusCounts();
  for (const item of items) {
    const key = item.status as keyof ExpertBrainStatusCounts;
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

export function expertStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendente",
    processing: "Processando",
    ready: "Pronto",
    failed: "Falhou",
    partial: "Parcial",
  };
  return labels[status] ?? status;
}

export function expertStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "text-zinc-400 bg-zinc-500/10",
    processing: "text-amber-400 bg-amber-500/10",
    ready: "text-emerald-400 bg-emerald-500/10",
    failed: "text-red-400 bg-red-500/10",
    partial: "text-orange-400 bg-orange-500/10",
  };
  return colors[status] ?? "text-zinc-400 bg-zinc-500/10";
}

export function mapFrameworkArtifact(framework: ExpertFramework): ExpertBrainArtifactSummary {
  return {
    id: framework.id,
    title: framework.name,
    category: framework.category,
    categoryLabel: EXPERT_BRAIN_CATEGORY_LABELS[framework.category],
    sourceId: framework.source_id,
    createdAt: framework.created_at,
  };
}

export function mapDecisionRuleArtifact(rule: ExpertDecisionRule): ExpertBrainArtifactSummary {
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    categoryLabel: EXPERT_BRAIN_CATEGORY_LABELS[rule.category],
    sourceId: rule.source_id,
    confidence: rule.confidence_score,
    createdAt: rule.created_at,
  };
}

export function mapSuccessPatternArtifact(pattern: ExpertSuccessPattern): ExpertBrainArtifactSummary {
  return {
    id: pattern.id,
    title: pattern.title,
    sourceId: pattern.source_id,
    createdAt: pattern.created_at,
  };
}

export function mapFailurePatternArtifact(pattern: ExpertFailurePattern): ExpertBrainArtifactSummary {
  return {
    id: pattern.id,
    title: pattern.title,
    sourceId: pattern.source_id,
    createdAt: pattern.created_at,
  };
}

export function buildCourseTree(
  courses: ExpertCourse[],
  modules: ExpertCourseModule[],
  lessons: ExpertCourseLesson[],
  transcripts: ExpertTranscript[] = []
): ExpertBrainCourseSummary[] {
  const transcriptByLesson = new Map<string, string>();
  for (const transcript of transcripts) {
    if (transcript.lesson_id) transcriptByLesson.set(transcript.lesson_id, transcript.id);
  }
  const modulesByCourse = new Map<string, ExpertCourseModule[]>();
  for (const mod of modules) {
    const list = modulesByCourse.get(mod.course_id) ?? [];
    list.push(mod);
    modulesByCourse.set(mod.course_id, list);
  }

  const lessonsByModule = new Map<string, ExpertCourseLesson[]>();
  for (const lesson of lessons) {
    const list = lessonsByModule.get(lesson.module_id) ?? [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }

  return courses.map((course) => {
    const courseModules = (modulesByCourse.get(course.id) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order
    );

    const moduleSummaries = courseModules.map((mod) => {
      const modLessons = (lessonsByModule.get(mod.id) ?? []).sort(
        (a, b) => a.sort_order - b.sort_order
      );

      const lessonSummaries: ExpertBrainLessonSummary[] = modLessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        status: lesson.status,
        sourceType: lesson.source_type,
        sourceId: lesson.source_id,
        fileName: lesson.file_name,
        transcriptId: transcriptByLesson.get(lesson.id) ?? null,
      }));

      return {
        id: mod.id,
        title: mod.title,
        status: mod.status,
        sortOrder: mod.sort_order,
        lessons: lessonSummaries,
        statusCounts: countByStatus(modLessons),
      };
    });

    const allLessons = courseModules.flatMap((mod) => lessonsByModule.get(mod.id) ?? []);

    return {
      id: course.id,
      title: course.title,
      author: course.author,
      niche: course.niche,
      status: course.status,
      modules: moduleSummaries,
      statusCounts: countByStatus(allLessons),
    };
  });
}
