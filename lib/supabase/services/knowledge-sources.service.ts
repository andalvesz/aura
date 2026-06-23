import type {
  KnowledgeJob,
  KnowledgeSource,
  TableInsert,
} from "@/types/database";
import {
  isDrivePdf,
  isDriveText,
  isDriveVideo,
  listDriveFolderContents,
  listDriveFolders,
  type DriveItem,
} from "@/lib/google-drive/client";
import { getGoogleDriveOAuthConfig } from "@/lib/google-drive";
import { mergeGrantedScopes, resolveGoogleCapabilities } from "@/lib/gmail/scopes";
import { saveGoogleCalendarConnection } from "@/lib/google-calendar/connection.service";
import { getValidGoogleAccessToken } from "@/lib/google/token.service";
import {
  ExpertDecisionRulesRepository,
  ExpertFailurePatternsRepository,
  ExpertFrameworksRepository,
  ExpertSuccessPatternsRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import {
  KnowledgeJobsRepository,
  KnowledgeSourcesRepository,
} from "@/lib/supabase/repositories/knowledge-sources.repository";
import type { KnowledgeInspectorData, KnowledgeSourcesDashboard } from "@/utils/knowledge-sources";
import { getOptionalDataContext } from "./context";

export type QueueDriveLessonInput = {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  courseName: string;
  moduleName?: string | null;
  lessonName?: string | null;
};

export type QueueUploadInput = {
  fileName: string;
  buffer: Buffer;
  courseName?: string | null;
  moduleName?: string | null;
  lessonName?: string | null;
};

function detectSourceType(fileName: string, mimeType?: string | null): KnowledgeSource["source_type"] {
  const lower = fileName.toLowerCase();
  if (mimeType?.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi|m4v)$/.test(lower)) {
    return "drive_video";
  }
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  return "txt";
}

async function createSourceWithJob(
  source: Omit<TableInsert<"knowledge_sources">, "user_id">
): Promise<{ source: KnowledgeSource | null; job: KnowledgeJob | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { source: null, job: null, error: "Usuário não autenticado." };

  const sourcesRepo = new KnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const jobsRepo = new KnowledgeJobsRepository(ctx.supabase, ctx.userId);

  const { data: createdSource, error: sourceError } = await sourcesRepo.create({
    ...source,
    status: "queued",
    progress: 5,
  });

  if (sourceError || !createdSource) {
    return { source: null, job: null, error: sourceError ?? "Erro ao criar fonte." };
  }

  const { data: job, error: jobError } = await jobsRepo.create({
    source_id: createdSource.id,
    status: "queued",
    stage: "queued",
  });

  if (jobError || !job) {
    return { source: createdSource, job: null, error: jobError ?? "Erro ao criar job." };
  }

  return { source: createdSource, job, error: null };
}

export async function getKnowledgeSourcesDashboard(): Promise<{
  dashboard: KnowledgeSourcesDashboard | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { dashboard: null, error: "Usuário não autenticado." };

  const sourcesRepo = new KnowledgeSourcesRepository(ctx.supabase, ctx.userId);
  const jobsRepo = new KnowledgeJobsRepository(ctx.supabase, ctx.userId);
  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const rulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const successRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);
  const failureRepo = new ExpertFailurePatternsRepository(ctx.supabase, ctx.userId);

  const [
    { data: sources },
    { data: jobs },
    { accessToken, error: tokenError },
    { data: frameworks },
    { data: decisionRules },
    { data: successPatterns },
    { data: failurePatterns },
  ] = await Promise.all([
    sourcesRepo.findAll(),
    jobsRepo.findAll(),
    getValidGoogleAccessToken(),
    frameworksRepo.findRecent(20),
    rulesRepo.findTop(20),
    successRepo.findRecent(15),
    failureRepo.findRecent(15),
  ]);

  const { connection } = await import("@/lib/google/token.service").then((m) =>
    m.getGoogleAccountConnection()
  );
  const capabilities = resolveGoogleCapabilities(connection?.granted_scopes);

  const list = sources ?? [];
  const inspector = buildInspectorFromSources(list, frameworks ?? [], decisionRules ?? [], successPatterns ?? [], failurePatterns ?? []);

  return {
    dashboard: {
      sources: list,
      jobs: jobs ?? [],
      driveConnected: capabilities.drive && Boolean(accessToken) && !tokenError,
      driveEmail: connection?.google_email ?? null,
      inspector,
      stats: {
        total: list.length,
        ready: list.filter((s: KnowledgeSource) => s.status === "ready").length,
        processing: list.filter((s: KnowledgeSource) => s.status === "processing" || s.status === "queued").length,
        failed: list.filter((s: KnowledgeSource) => s.status === "failed").length,
      },
    },
    error: null,
  };
}

function buildInspectorFromSources(
  sources: KnowledgeSource[],
  frameworks: import("@/types/database").ExpertFramework[],
  decisionRules: import("@/types/database").ExpertDecisionRule[],
  successPatterns: import("@/types/database").ExpertSuccessPattern[],
  failurePatterns: import("@/types/database").ExpertFailurePattern[]
): KnowledgeInspectorData {
  const courseMap = new Map<string, Map<string, Array<{ name: string; status: string; progress: number }>>>();

  for (const source of sources) {
    const course = source.course_name?.trim() || "Sem curso";
    const module = source.module_name?.trim() || "Geral";
    const lesson = source.lesson_name?.trim() || "Aula";

    if (!courseMap.has(course)) courseMap.set(course, new Map());
    const modMap = courseMap.get(course)!;
    if (!modMap.has(module)) modMap.set(module, []);
    modMap.get(module)!.push({
      name: lesson,
      status: source.status,
      progress: source.progress,
    });
  }

  const courses = Array.from(courseMap.entries()).map(([name, modMap]) => ({
    name,
    modules: Array.from(modMap.entries()).map(([modName, lessons]) => ({
      name: modName,
      lessons,
    })),
  }));

  return {
    courses,
    frameworks: frameworks.map((f) => ({ name: f.name, category: f.category })),
    decisionRules: decisionRules.map((r) => ({ title: r.title, rule: r.rule })),
    successPatterns: successPatterns.map((p) => ({ title: p.title })),
    failurePatterns: failurePatterns.map((p) => ({ title: p.title })),
  };
}

export async function getDriveBrowse(parentId?: string | null): Promise<{
  folders: DriveItem[];
  files: DriveItem[];
  error: string | null;
}> {
  const { accessToken, error } = await getValidGoogleAccessToken();
  if (!accessToken) {
    return { folders: [], files: [], error: error ?? "Google Drive não conectado." };
  }

  try {
    if (!parentId) {
      const folders = await listDriveFolders(accessToken);
      return { folders, files: [], error: null };
    }

    const contents = await listDriveFolderContents(accessToken, parentId);
    return {
      folders: contents.filter((i) => i.isFolder),
      files: contents.filter((i) => !i.isFolder && (isDriveVideo(i) || isDrivePdf(i) || isDriveText(i))),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar Drive.";
    return { folders: [], files: [], error: message };
  }
}

export async function queueDriveLessons(
  lessons: QueueDriveLessonInput[]
): Promise<{ queued: number; error: string | null }> {
  if (!lessons.length) return { queued: 0, error: "Nenhuma aula selecionada." };

  let queued = 0;
  for (const lesson of lessons) {
    const sourceType = detectSourceType(lesson.fileName, lesson.mimeType);
    const { error } = await createSourceWithJob({
      source_type: sourceType,
      provider: "google_drive",
      course_name: lesson.courseName,
      module_name: lesson.moduleName ?? null,
      lesson_name: lesson.lessonName ?? lesson.fileName,
      drive_file_id: lesson.driveFileId,
      drive_mime_type: lesson.mimeType,
      metadata: { fileName: lesson.fileName },
    });
    if (!error) queued += 1;
  }

  return { queued, error: queued === 0 ? "Nenhuma aula foi enfileirada." : null };
}

export async function queueUploadFile(
  input: QueueUploadInput
): Promise<{ source: KnowledgeSource | null; job: KnowledgeJob | null; error: string | null }> {
  const sourceType = detectSourceType(input.fileName);
  const lessonName = input.lessonName ?? input.fileName.replace(/\.[^.]+$/, "");

  const { source, job, error } = await createSourceWithJob({
    source_type: sourceType === "drive_video" ? "pdf" : sourceType,
    provider: "upload",
    course_name: input.courseName ?? lessonName,
    module_name: input.moduleName ?? null,
    lesson_name: lessonName,
    metadata: {
      fileName: input.fileName,
      uploadText: sourceType !== "drive_video" ? input.buffer.toString("utf-8") : null,
      isPdf: sourceType === "pdf",
      pdfBase64: sourceType === "pdf" ? input.buffer.toString("base64") : null,
    },
  });

  return { source, job, error };
}

export async function saveGoogleDriveConnection(params: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email?: string | null;
  grantedScopes?: string | null;
}) {
  return saveGoogleCalendarConnection(params);
}

export async function getDriveConnectionStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  email: string | null;
}> {
  const configured = Boolean(getGoogleDriveOAuthConfig());
  const { connection } = await import("@/lib/google/token.service").then((m) =>
    m.getGoogleAccountConnection()
  );
  const capabilities = resolveGoogleCapabilities(connection?.granted_scopes);

  return {
    connected: Boolean(connection?.access_token) && capabilities.drive,
    configured,
    email: connection?.google_email ?? null,
  };
}
