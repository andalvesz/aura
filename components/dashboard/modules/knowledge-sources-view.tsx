"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  Upload,
  Video,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useKnowledgeSources } from "@/hooks/use-knowledge-sources";
import { cn } from "@/utils/cn";
import {
  KNOWLEDGE_JOB_STAGE_LABELS,
  knowledgeJobStageColor,
} from "@/utils/knowledge-sources";
import type { KnowledgeJob, KnowledgeSource } from "@/types/database";

function SourceStatusBadge({ status }: { status: KnowledgeSource["status"] }) {
  const colors: Record<KnowledgeSource["status"], string> = {
    pending: "text-zinc-400",
    queued: "text-amber-400",
    processing: "text-violet-400",
    ready: "text-emerald-400",
    failed: "text-red-400",
  };
  return <span className={cn("text-[10px] capitalize", colors[status])}>{status}</span>;
}

export function KnowledgeSourcesView() {
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"drive" | "upload" | "inspector" | "queue">("drive");

  const {
    dashboard,
    loading,
    busy,
    error,
    refresh,
    connectDrive,
    uploadFile,
    browseDrive,
    driveFolders,
    driveFiles,
    drivePath,
    setDrivePath,
    selectedCourse,
    setSelectedCourse,
    selectedModule,
    setSelectedModule,
    selectedLessons,
    toggleLesson,
    queueSelectedLessons,
    processQueue,
    clearSelectedLessons,
  } = useKnowledgeSources();

  useEffect(() => {
    if (searchParams.get("drive_connected")) {
      toast.success("Google Drive conectado.");
      void browseDrive();
    }
    const driveError = searchParams.get("drive_error");
    if (driveError) toast.error(`Drive: ${driveError}`);
  }, [searchParams, browseDrive]);

  useEffect(() => {
    if (dashboard?.driveConnected && activeTab === "drive") {
      void browseDrive(drivePath[drivePath.length - 1]?.id);
    }
  }, [dashboard?.driveConnected, activeTab]);

  async function handleBrowseFolder(folder: { id: string; name: string }, asCourse?: boolean) {
    if (asCourse) {
      setSelectedCourse({ id: folder.id, name: folder.name, mimeType: "", isFolder: true, size: null, modifiedTime: null });
      setSelectedModule(null);
      clearSelectedLessons();
    } else if (selectedCourse && !selectedModule) {
      setSelectedModule({ id: folder.id, name: folder.name, mimeType: "", isFolder: true, size: null, modifiedTime: null });
    }
    setDrivePath((prev) => [...prev, folder]);
    await browseDrive(folder.id);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await uploadFile(file);
    if (ok) toast.success("Arquivo enfileirado para processamento.");
    e.target.value = "";
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-[12px] text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total de fontes" value={String(dashboard?.stats.total ?? 0)} />
        <MetricCard label="Prontas" value={String(dashboard?.stats.ready ?? 0)} />
        <MetricCard label="Processando" value={String(dashboard?.stats.processing ?? 0)} />
        <MetricCard label="Falhas" value={String(dashboard?.stats.failed ?? 0)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["drive", "upload", "queue", "inspector"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-[11px] transition-colors",
              activeTab === tab
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                : "border-white/[0.06] text-zinc-400 hover:text-zinc-200"
            )}
          >
            {tab === "drive" && "Google Drive"}
            {tab === "upload" && "Upload TXT/PDF"}
            {tab === "queue" && "Fila"}
            {tab === "inspector" && "Knowledge Inspector"}
          </button>
        ))}
        <ActionButton variant="ghost" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
        </ActionButton>
      </div>

      {activeTab === "drive" && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2 text-[13px]">
              <HardDrive className="size-3.5 text-cyan-400" />
              Google Drive
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-4">
            {!dashboard?.driveConnected ? (
              <div className="space-y-3">
                <p className="text-[12px] text-zinc-400">
                  Conecte sua conta Google para listar pastas e selecionar cursos. Vídeos são processados
                  temporariamente — nunca armazenados permanentemente.
                </p>
                <ActionButton onClick={() => void connectDrive()}>
                  Conectar Google Drive
                </ActionButton>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-zinc-500">
                  Conectado como {dashboard.driveEmail ?? "conta Google"}
                </p>

                {selectedCourse && (
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-300">
                    <p>
                      <span className="text-zinc-500">Curso:</span> {selectedCourse.name}
                    </p>
                    {selectedModule && (
                      <p>
                        <span className="text-zinc-500">Módulo:</span> {selectedModule.name}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  {driveFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => void handleBrowseFolder(folder, !selectedCourse)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-200 hover:bg-white/[0.04]"
                    >
                      <Folder className="size-3.5 text-amber-400" />
                      {folder.name}
                      <ChevronRight className="ml-auto size-3 text-zinc-600" />
                    </button>
                  ))}
                </div>

                {driveFiles.length > 0 && (
                  <div className="space-y-1 border-t border-white/[0.06] pt-3">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">Aulas</p>
                    {driveFiles.map((file) => (
                      <label
                        key={file.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.04]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedLessons.has(file.id)}
                          onChange={() => toggleLesson(file.id)}
                          className="rounded border-white/20"
                        />
                        {file.mimeType.startsWith("video/") ? (
                          <Video className="size-3.5 text-violet-400" />
                        ) : (
                          <FileText className="size-3.5 text-sky-400" />
                        )}
                        <span className="text-[12px] text-zinc-200">{file.name}</span>
                      </label>
                    ))}
                  </div>
                )}

                {selectedCourse && selectedLessons.size > 0 && (
                  <ActionButton
                    onClick={async () => {
                      const ok = await queueSelectedLessons();
                      if (ok) toast.success(`${selectedLessons.size} aula(s) enfileirada(s).`);
                    }}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Criar fila ({selectedLessons.size})
                  </ActionButton>
                )}
              </>
            )}
          </PanelContent>
        </Panel>
      )}

      {activeTab === "upload" && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2 text-[13px]">
              <Upload className="size-3.5 text-emerald-400" />
              Upload TXT / PDF
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3">
            <p className="text-[12px] text-zinc-400">
              Envie transcrições ou PDFs. O texto é extraído e alimenta o Expert Brain automaticamente.
            </p>
            <input ref={fileRef} type="file" accept=".txt,.pdf" className="hidden" onChange={(e) => void handleUpload(e)} />
            <ActionButton onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              Selecionar arquivo
            </ActionButton>
          </PanelContent>
        </Panel>
      )}

      {activeTab === "queue" && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="text-[13px]">Fila de processamento</PanelTitle>
            <ActionButton variant="ghost" onClick={() => void processQueue()} disabled={busy}>
              Processar fila
            </ActionButton>
          </PanelHeader>
          <PanelContent>
            {!dashboard?.jobs.length ? (
              <EmptyState title="Fila vazia" description="Selecione aulas no Drive ou faça upload." />
            ) : (
              <div className="space-y-2">
                {dashboard.jobs.map((job: KnowledgeJob) => {
                  const source = dashboard.sources.find((s) => s.id === job.source_id);
                  return (
                    <div
                      key={job.id}
                      className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-zinc-100">
                          {source?.lesson_name ?? source?.course_name ?? "Fonte"}
                        </p>
                        <span className={cn("text-[10px]", knowledgeJobStageColor(job.stage))}>
                          {KNOWLEDGE_JOB_STAGE_LABELS[job.stage]}
                        </span>
                      </div>
                      {source && (
                        <p className="mt-1 text-[10px] text-zinc-500">
                          {source.course_name} · {source.module_name ?? "—"} · {source.progress}%
                        </p>
                      )}
                      {job.error && <p className="mt-1 text-[10px] text-red-400">{job.error}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </PanelContent>
        </Panel>
      )}

      {activeTab === "inspector" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader>
              <PanelTitle className="flex items-center gap-2 text-[13px]">
                <FolderOpen className="size-3.5 text-amber-400" />
                Cursos · Módulos · Aulas
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-3">
              {!dashboard?.inspector.courses.length ? (
                <EmptyState title="Sem cursos" description="Processe fontes para ver a hierarquia." />
              ) : (
                dashboard.inspector.courses.map((course) => (
                  <div key={course.name} className="space-y-2">
                    <p className="text-[12px] font-medium text-zinc-100">{course.name}</p>
                    {course.modules.map((mod) => (
                      <div key={mod.name} className="ml-3 space-y-1">
                        <p className="text-[11px] text-zinc-400">{mod.name}</p>
                        {mod.lessons.map((lesson) => (
                          <div key={lesson.name} className="ml-3 flex items-center justify-between text-[10px]">
                            <span className="text-zinc-300">{lesson.name}</span>
                            <SourceStatusBadge status={lesson.status as KnowledgeSource["status"]} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle className="flex items-center gap-2 text-[13px]">
                <BookOpen className="size-3.5 text-violet-400" />
                Conhecimento extraído
              </PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-4">
              <div>
                <p className="mb-2 text-[10px] uppercase text-zinc-500">Frameworks</p>
                <div className="flex flex-wrap gap-1">
                  {dashboard?.inspector.frameworks.map((f) => (
                    <span key={f.name} className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] uppercase text-zinc-500">Decision rules</p>
                <ul className="space-y-1">
                  {dashboard?.inspector.decisionRules.slice(0, 8).map((r) => (
                    <li key={r.title} className="text-[11px] text-zinc-300">
                      {r.title}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-2 text-[10px] uppercase text-emerald-500">Success patterns</p>
                  {dashboard?.inspector.successPatterns.slice(0, 5).map((p) => (
                    <p key={p.title} className="text-[10px] text-zinc-400">
                      {p.title}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-[10px] uppercase text-red-400">Failure patterns</p>
                  {dashboard?.inspector.failurePatterns.slice(0, 5).map((p) => (
                    <p key={p.title} className="text-[10px] text-zinc-400">
                      {p.title}
                    </p>
                  ))}
                </div>
              </div>
            </PanelContent>
          </Panel>
        </div>
      )}
    </div>
  );
}
