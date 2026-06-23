"use client";

import { useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  FolderArchive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useExpertBrain, type ExpertUploadMode } from "@/hooks/use-expert-brain";
import { cn } from "@/utils/cn";
import { EXPERT_BRAIN_UPLOAD_LIMIT_LABEL } from "@/utils/expert-brain-storage";
import {
  ingestionStatusColor,
  ingestionStatusLabel,
  PIPELINE_STAGE_LABELS,
  pipelineProgressForStatus,
  pipelineStageIndex,
} from "@/utils/expert-brain-pipeline";
import type { ExpertIngestionQueueItem } from "@/types/database";
import {
  expertStatusColor,
  expertStatusLabel,
  type ExpertBrainArtifactSummary,
  type ExpertBrainCourseSummary,
} from "@/utils/expert-brain-dashboard";

const UPLOAD_TABS: Array<{
  mode: ExpertUploadMode;
  label: string;
  icon: typeof FolderArchive;
  accept: string;
  multiple: boolean;
  hint: string;
}> = [
  {
    mode: "zip",
    label: "ZIP",
    icon: FolderArchive,
    accept: ".zip",
    multiple: false,
    hint: "Upload direto ao Storage — estrutura curso/módulo/aula (.pdf, .txt, .md, .mp4)",
  },
  {
    mode: "videos",
    label: "Vídeos",
    icon: Video,
    accept: "video/*",
    multiple: true,
    hint: "Upload direto ao Storage — transcreve via Whisper quando OPENAI_API_KEY estiver configurada",
  },
  {
    mode: "pdfs",
    label: "PDFs",
    icon: FileText,
    accept: ".pdf",
    multiple: true,
    hint: "Upload direto ao Storage — extrai texto automaticamente de cada PDF",
  },
  {
    mode: "transcripts",
    label: "TXT/MD",
    icon: BookOpen,
    accept: ".txt,.md,.markdown",
    multiple: true,
    hint: "Upload direto ao Storage — transcrições prontas em texto ou markdown",
  },
];

function IngestionStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        ingestionStatusColor(status)
      )}
    >
      {ingestionStatusLabel(status)}
    </span>
  );
}

function PipelineProgressBar({ status, progress }: { status: string; progress: number }) {
  const currentIndex = pipelineStageIndex(status);
  const percent = progress || pipelineProgressForStatus(status);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        {PIPELINE_STAGE_LABELS.map((stage, index) => (
          <span
            key={stage.key}
            className={cn(index <= currentIndex ? "text-violet-300" : "text-zinc-600")}
          >
            {stage.label}
          </span>
        ))}
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-white/[0.06]">
        <div className="h-full bg-violet-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[10px] text-zinc-600">{percent}%</p>
    </div>
  );
}

function ProcessingPanel({ items }: { items: ExpertIngestionQueueItem[] }) {
  if (!items.length) {
    return <p className="text-[11px] text-zinc-500">Nenhum processamento em andamento.</p>;
  }

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto">
      {items.map((item) => (
        <div key={item.id} className="rounded border border-white/[0.06] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-[12px] font-medium text-zinc-100">
              {item.file_name ?? item.file_path.split("/").pop()}
            </p>
            <IngestionStatusBadge status={item.status} />
          </div>
          <PipelineProgressBar status={item.status} progress={item.progress} />
          <p className="mt-2 text-[10px] text-zinc-600">
            {item.course_name ?? "Sem curso"}
            {item.module_name ? ` · ${item.module_name}` : ""}
            {item.lesson_name ? ` · ${item.lesson_name}` : ""}
          </p>
          {item.error ? <p className="mt-1 text-[10px] text-red-400">{item.error}</p> : null}
        </div>
      ))}
    </div>
  );
}

function PreviewModal({
  title,
  content,
  onClose,
}: {
  title: string;
  content: string;
  onClose: () => void;
}) {
  if (!content) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-white/10 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
          <ActionButton variant="ghost" className="h-7 min-h-7 px-2" onClick={onClose}>
            Fechar
          </ActionButton>
        </div>
        <pre className="overflow-auto whitespace-pre-wrap p-4 text-[11px] leading-relaxed text-zinc-300">
          {content}
        </pre>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        expertStatusColor(status)
      )}
    >
      {expertStatusLabel(status)}
    </span>
  );
}

function ArtifactList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: ExpertBrainArtifactSummary[];
  emptyLabel: string;
}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
      </PanelHeader>
      <PanelContent>
        {items.length === 0 ? (
          <p className="text-[11px] text-zinc-500">{emptyLabel}</p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="rounded border border-white/[0.06] p-2">
                <p className="text-[12px] font-medium text-zinc-100">{item.title}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                  {item.categoryLabel ? <span>{item.categoryLabel}</span> : null}
                  {item.confidence != null ? <span>Conf. {item.confidence}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}

function CourseTree({
  course,
  onReprocess,
  onViewTranscript,
  onViewKnowledge,
  busy,
}: {
  course: ExpertBrainCourseSummary;
  onReprocess: (type: "lesson" | "module" | "course", id: string) => void;
  onViewTranscript: (lessonId: string) => void;
  onViewKnowledge: (sourceId: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  return (
    <div className="rounded border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2 p-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-zinc-100">{course.title}</p>
            <p className="text-[10px] text-zinc-500">
              {course.modules.length} módulo(s) · {course.niche ?? "Sem nicho"}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <StatusBadge status={course.status} />
          <ActionButton
            variant="ghost"
            disabled={busy}
            className="h-7 min-h-7 px-2"
            onClick={() => onReprocess("course", course.id)}
          >
            <RotateCcw className="size-3" />
          </ActionButton>
        </div>
      </div>

      {open ? (
        <div className="space-y-1 border-t border-white/[0.06] p-2">
          {course.modules.map((mod) => {
            const modOpen = openModules[mod.id] ?? true;
            return (
              <div key={mod.id} className="rounded bg-black/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() =>
                      setOpenModules((prev) => ({ ...prev, [mod.id]: !modOpen }))
                    }
                  >
                    {modOpen ? (
                      <ChevronDown className="size-3 shrink-0 text-zinc-500" />
                    ) : (
                      <ChevronRight className="size-3 shrink-0 text-zinc-500" />
                    )}
                    <p className="truncate text-[12px] text-zinc-200">{mod.title}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={mod.status} />
                    <ActionButton
                      variant="ghost"
                      disabled={busy}
                      className="h-7 min-h-7 px-2"
                      onClick={() => onReprocess("module", mod.id)}
                    >
                      <RotateCcw className="size-3" />
                    </ActionButton>
                  </div>
                </div>

                {modOpen ? (
                  <div className="mt-2 space-y-1 pl-5">
                    {mod.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-white/[0.03]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] text-zinc-300">{lesson.title}</p>
                          <p className="text-[10px] text-zinc-600">{lesson.sourceType}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={lesson.status} />
                          <ActionButton
                            variant="ghost"
                            disabled={busy}
                            className="h-7 min-h-7 px-2"
                            title="Reprocessar Aula"
                            onClick={() => onReprocess("lesson", lesson.id)}
                          >
                            <RotateCcw className="size-3" />
                          </ActionButton>
                          {lesson.transcriptId || lesson.sourceType === "video" ? (
                            <ActionButton
                              variant="ghost"
                              disabled={busy}
                              className="h-7 min-h-7 px-2"
                              title="Ver Transcrição"
                              onClick={() => onViewTranscript(lesson.id)}
                            >
                              <FileText className="size-3" />
                            </ActionButton>
                          ) : null}
                          {lesson.sourceId ? (
                            <ActionButton
                              variant="ghost"
                              disabled={busy}
                              className="h-7 min-h-7 px-2"
                              title="Ver Conhecimento Extraído"
                              onClick={() => onViewKnowledge(lesson.sourceId!)}
                            >
                              <Eye className="size-3" />
                            </ActionButton>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ExpertBrainView() {
  const {
    dashboard,
    loading,
    error,
    busy,
    uploadProgress,
    refresh,
    uploadFiles,
    processQueue,
    reprocess,
    fetchTranscript,
    fetchKnowledge,
  } = useExpertBrain();
  const [uploadMode, setUploadMode] = useState<ExpertUploadMode>("zip");
  const [courseTitle, setCourseTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [niche, setNiche] = useState("");
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeTab = UPLOAD_TABS.find((t) => t.mode === uploadMode) ?? UPLOAD_TABS[0];

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;

    const { error: uploadError, message } = await uploadFiles({
      mode: uploadMode,
      files,
      courseTitle: courseTitle || undefined,
      author: author || undefined,
      niche: niche || undefined,
    });

    if (uploadError) {
      toast.error(uploadError);
      return;
    }

    toast.success(message ?? "Upload concluído.");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleProcessQueue() {
    const { error: queueError, message } = await processQueue(5);
    if (queueError) {
      toast.error(queueError);
      return;
    }
    toast.success(message ?? "Fila processada.");
  }

  async function handleReprocess(type: "lesson" | "module" | "course", id: string) {
    const { error: reprocessError, message } = await reprocess(type, id);
    if (reprocessError) {
      toast.error(reprocessError);
      return;
    }
    toast.success(message ?? "Reprocessado.");
  }

  async function handleViewTranscript(lessonId: string) {
    const { error: transcriptError, text } = await fetchTranscript({ lessonId });
    if (transcriptError || !text) {
      toast.error(transcriptError ?? "Transcrição indisponível.");
      return;
    }
    setPreview({ title: "Transcrição da aula", content: text });
  }

  async function handleViewKnowledge(sourceId: string) {
    const { error: knowledgeError, knowledge } = await fetchKnowledge(sourceId);
    if (knowledgeError || !knowledge) {
      toast.error(knowledgeError ?? "Conhecimento indisponível.");
      return;
    }
    setPreview({
      title: "Conhecimento extraído",
      content: JSON.stringify(knowledge, null, 2),
    });
  }

  const pipelineItems =
    dashboard?.ingestionQueue.filter((item) =>
      ["uploaded", "transcribing", "extracting", "waiting_for_openai", "pending", "processing"].includes(
        item.status
      )
    ) ?? [];

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Expert Brain" description={error} />;
  }

  const metrics = dashboard?.metrics;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/dashboard/expert-brain/influence"
          className="rounded-md border border-violet-500/20 bg-violet-500/[0.06] px-3 py-1.5 text-[11px] text-violet-200 hover:bg-violet-500/10"
        >
          Influence Audit →
        </Link>
      </div>
      {preview ? (
        <PreviewModal
          title={preview.title}
          content={preview.content}
          onClose={() => setPreview(null)}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Inteligência de especialistas — cursos viram frameworks, regras e padrões para o Aura
        </p>
        <div className="flex gap-2">
          <ActionButton variant="ghost" disabled={busy} onClick={() => refresh()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Atualizar
          </ActionButton>
          <ActionButton disabled={busy} onClick={handleProcessQueue}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Processar fila
          </ActionButton>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Cursos" value={String(metrics?.courses ?? 0)} />
        <MetricCard label="Aulas" value={String(metrics?.lessons ?? 0)} />
        <MetricCard
          label="Fila"
          value={String((metrics?.queuePending ?? 0) + (metrics?.queueProcessing ?? 0))}
        />
        <MetricCard label="Frameworks" value={String(metrics?.frameworks ?? 0)} />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Upload className="size-3.5 text-violet-400" />
            Upload de conhecimento
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {UPLOAD_TABS.map((tab) => (
              <button
                key={tab.mode}
                type="button"
                onClick={() => setUploadMode(tab.mode)}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] transition",
                  uploadMode === tab.mode
                    ? "bg-violet-500/20 text-violet-300"
                    : "bg-white/[0.04] text-zinc-400 hover:text-zinc-200"
                )}
              >
                <tab.icon className="size-3" />
                {tab.label}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-zinc-500">
            {activeTab.hint} · {EXPERT_BRAIN_UPLOAD_LIMIT_LABEL} · Upload direto ao Supabase Storage
          </p>

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="Título do curso (opcional)"
              className="rounded border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-violet-500/40"
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Autor (opcional)"
              className="rounded border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-violet-500/40"
            />
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Nicho (opcional)"
              className="rounded border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-violet-500/40"
            />
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-white/[0.12] bg-black/10 px-4 py-8 transition hover:border-violet-500/30 hover:bg-violet-500/5">
            <Upload className="size-5 text-zinc-500" />
            <span className="text-[12px] text-zinc-400">
              Clique para selecionar {activeTab.multiple ? "arquivos" : "arquivo"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept={activeTab.accept}
              multiple={activeTab.multiple}
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>

          {uploadProgress.length > 0 ? (
            <div className="space-y-2 rounded border border-white/[0.06] p-2">
              {uploadProgress.map((item) => (
                <div key={item.fileName} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-zinc-300">{item.fileName}</span>
                    <span className="text-zinc-500">{item.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-white/[0.06]">
                    <div
                      className={cn(
                        "h-full transition-all",
                        item.status === "failed" ? "bg-red-500" : "bg-violet-500"
                      )}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                  {item.error ? (
                    <p className="text-[10px] text-red-400">{item.error}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Processamento</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <ProcessingPanel items={pipelineItems.length ? pipelineItems : dashboard?.ingestionQueue ?? []} />
        </PanelContent>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Fila de ingestão (Storage)</PanelTitle>
          </PanelHeader>
          <PanelContent>
            {!dashboard?.ingestionQueue.length ? (
              <p className="text-[11px] text-zinc-500">Nenhum arquivo na fila de ingestão.</p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {dashboard.ingestionQueue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded border border-white/[0.06] p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11px] text-zinc-200">
                        {item.file_name ?? item.file_path.split("/").pop()}
                      </p>
                      <IngestionStatusBadge status={item.status} />
                    </div>
                    <div className="mt-2">
                      <PipelineProgressBar status={item.status} progress={item.progress} />
                    </div>
                    {item.error ? (
                      <p className="mt-1 text-[10px] text-red-400">{item.error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Fila de extração (IA)</PanelTitle>
          </PanelHeader>
          <PanelContent>
            {!dashboard?.queue.length ? (
              <p className="text-[11px] text-zinc-500">Nenhum item na fila de extração.</p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {dashboard.queue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded border border-white/[0.06] p-2"
                  >
                    <div>
                      <p className="text-[11px] text-zinc-200">
                        {item.action === "reprocess" ? "Reprocessar" : "Processar"}{" "}
                        {item.entity_type}
                      </p>
                      <p className="text-[10px] text-zinc-600">{item.entity_id.slice(0, 8)}…</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Status geral</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(["pending", "processing", "ready", "failed", "partial"] as const).map((key) => (
                <div key={key} className="rounded bg-white/[0.03] p-2 text-center">
                  <p className="text-[16px] font-semibold text-zinc-100">
                    {dashboard?.statusCounts[key] ?? 0}
                  </p>
                  <p className="text-[10px] text-zinc-500">{expertStatusLabel(key)}</p>
                </div>
              ))}
            </div>
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Cursos · Módulos · Aulas</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {!dashboard?.courses.length ? (
            <EmptyState
              title="Nenhum curso"
              description="Faça upload de um ZIP, PDFs, vídeos ou transcrições para começar."
            />
          ) : (
            dashboard.courses.map((course) => (
              <CourseTree
                key={course.id}
                course={course}
                busy={busy}
                onReprocess={handleReprocess}
                onViewTranscript={handleViewTranscript}
                onViewKnowledge={handleViewKnowledge}
              />
            ))
          )}
        </PanelContent>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <ArtifactList
          title="Frameworks extraídos"
          items={dashboard?.frameworks ?? []}
          emptyLabel="Nenhum framework extraído ainda."
        />
        <ArtifactList
          title="Decision Rules"
          items={dashboard?.decisionRules ?? []}
          emptyLabel="Nenhuma decision rule extraída ainda."
        />
        <ArtifactList
          title="Success Patterns"
          items={dashboard?.successPatterns ?? []}
          emptyLabel="Nenhum success pattern extraído ainda."
        />
        <ArtifactList
          title="Failure Patterns"
          items={dashboard?.failurePatterns ?? []}
          emptyLabel="Nenhum failure pattern extraído ainda."
        />
      </div>
    </div>
  );
}
