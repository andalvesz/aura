"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addProjectDocumentAction,
  addProjectMemberAction,
  linkMemoryToProjectAction,
  setProjectStatusAction,
  toggleProjectFavoriteAction,
  unlinkMemoryFromProjectAction,
} from "@/app/actions/projects";
import { createKnowledgeDocumentAction } from "@/app/actions/knowledge";
import { CommentsPanel } from "@/components/dashboard/daily/comments-panel";
import type { DiscoveryArtifact } from "@/lib/discovery/types";
import type { KnowledgeDocument } from "@/lib/knowledge/types";
import { DOCUMENT_TYPE_LABELS } from "@/lib/knowledge/types";
import type {
  Project,
  ProjectDocument,
  ProjectStatus,
  ProjectTimelineEvent,
} from "@/lib/projects/types";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
} from "@/lib/projects/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { groupDiscoveriesByType } from "@/lib/projects/discovery";

type MemoryLite = { id: string; title: string };

export function ProjectDetailClient({
  project,
  timeline,
  documents,
  discoveries,
  memories,
  knowledgeDocuments = [],
}: {
  project: Project;
  timeline: ProjectTimelineEvent[];
  documents: ProjectDocument[];
  discoveries: DiscoveryArtifact[];
  memories: MemoryLite[];
  knowledgeDocuments?: KnowledgeDocument[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<
    | "resumo"
    | "timeline"
    | "discovery"
    | "memorias"
    | "documentos"
    | "comentarios"
    | "atividade"
    | "membros"
  >("resumo");
  const [memberId, setMemberId] = useState("");
  const [memoryId, setMemoryId] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");

  const byType = groupDiscoveriesByType(discoveries);

  const tabs = [
    ["resumo", "Resumo"],
    ["timeline", "Timeline"],
    ["discovery", "Discovery"],
    ["memorias", "Memórias"],
    ["documentos", "Documentos"],
    ["comentarios", "Comentários"],
    ["atividade", "Atividade"],
    ["membros", "Membros"],
  ] as const;

  return (
    <div className="space-y-4" data-testid="project-detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ background: project.color }}
            />
            <h1 className="text-lg font-medium text-zinc-100">{project.name}</h1>
            <button
              type="button"
              disabled={pending}
              className="text-amber-300"
              onClick={() =>
                start(async () => {
                  await toggleProjectFavoriteAction(project.id);
                  router.refresh();
                })
              }
            >
              {project.favorite ? "★" : "☆"}
            </button>
          </div>
          <p className="mt-1 text-[13px] text-zinc-500">
            {project.description || "Sem descrição"}
          </p>
        </div>
        <select
          value={project.status}
          disabled={pending}
          className={`${FORM_INPUT_CLASS} w-auto min-w-[9rem]`}
          onChange={(e) =>
            start(async () => {
              await setProjectStatusAction(
                project.id,
                e.target.value as ProjectStatus
              );
              toast.success("Status atualizado");
              router.refresh();
            })
          }
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-11 shrink-0 rounded border px-2.5 text-[11px] md:min-h-0 md:py-1.5 ${
              tab === id
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                : "border-white/10 text-zinc-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "resumo" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Memórias", memories.length, "memorias"],
            ["Documentos", documents.length, "documentos"],
            ["Discovery", discoveries.length, "discovery"],
            ["Membros", project.members.length, "membros"],
          ].map(([label, count, t]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => setTab(t as typeof tab)}
              className="rounded-lg border border-white/10 bg-zinc-950/50 p-3 text-left"
            >
              <p className="text-[10px] uppercase text-zinc-600">{label}</p>
              <p className="text-xl text-zinc-100">{count}</p>
            </button>
          ))}
          <div className="sm:col-span-2 lg:col-span-4">
            <Link
              href={`/dashboard/projects/${project.id}/documents`}
              className="text-[12px] text-cyan-400 hover:underline"
            >
              Abrir documentos →
            </Link>
          </div>
        </div>
      ) : null}

      {tab === "timeline" || tab === "atividade" ? (
        <ol className="space-y-2 border-l border-white/10 pl-3">
          {timeline.length === 0 ? (
            <p className="text-[13px] text-zinc-500">Sem eventos ainda.</p>
          ) : (
            timeline.map((e) => (
              <li key={e.id} className="text-[12px]">
                <p className="text-[10px] uppercase text-zinc-600">{e.kind}</p>
                <p className="text-zinc-200">{e.title}</p>
                {e.summary ? (
                  <p className="text-[11px] text-zinc-500">{e.summary}</p>
                ) : null}
                <time className="text-[10px] text-zinc-600">
                  {new Date(e.createdAt).toLocaleString("pt-BR")}
                </time>
              </li>
            ))
          )}
        </ol>
      ) : null}

      {tab === "discovery" ? (
        <div className="space-y-3">
          {(
            [
              "OPPORTUNITY",
              "RISK",
              "GAP",
              "DEPENDENCY",
              "STAGNATION",
            ] as const
          ).map((type) => {
            const list = byType[type] ?? [];
            if (!list.length) return null;
            return (
              <div key={type}>
                <p className="mb-1 text-[11px] uppercase text-zinc-500">{type}</p>
                <ul className="space-y-1">
                  {list.map((d) => (
                    <li key={d.id}>
                      <Link
                        href={`/dashboard/discovery?id=${d.id}`}
                        className="text-[13px] text-zinc-200 hover:text-cyan-300"
                      >
                        {d.title}
                      </Link>
                      <span className="ml-2 text-[10px] text-zinc-600">
                        execução: {d.executionInfluence}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!discoveries.length ? (
            <p className="text-[13px] text-zinc-500">
              Nenhuma descoberta relacionada ainda.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "memorias" ? (
        <div className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await linkMemoryToProjectAction({
                  projectId: project.id,
                  memoryId: memoryId.trim(),
                });
                if (res.error) toast.error(res.error);
                else {
                  toast.success("Memória vinculada");
                  setMemoryId("");
                  router.refresh();
                }
              });
            }}
          >
            <input
              value={memoryId}
              onChange={(e) => setMemoryId(e.target.value)}
              placeholder="ID da memória"
              className={FORM_INPUT_CLASS}
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
            >
              Vincular
            </button>
          </form>
          <ul className="space-y-1">
            {memories.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 text-[13px]"
              >
                <Link
                  href={`/dashboard/settings/memory#${m.id}`}
                  className="text-zinc-200 hover:text-cyan-300"
                >
                  {m.title}
                </Link>
                <button
                  type="button"
                  className="text-[10px] text-zinc-500 hover:text-rose-300"
                  onClick={() =>
                    start(async () => {
                      await unlinkMemoryFromProjectAction({
                        projectId: project.id,
                        memoryId: m.id,
                      });
                      router.refresh();
                    })
                  }
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "documentos" ? (
        <div className="space-y-3" data-testid="project-knowledge-docs">
          <p className="text-[12px] text-zinc-500">Documentação completa</p>
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const k = await createKnowledgeDocumentAction({
                  title: docTitle || docUrl || "Documento do projeto",
                  type: docUrl ? "link" : "note",
                  url: docUrl || null,
                  projectId: project.id,
                  description: `Projeto ${project.name}`,
                });
                const res = await addProjectDocumentAction({
                  projectId: project.id,
                  kind: "link",
                  title: docTitle || docUrl,
                  fileName: docTitle || "link",
                  mimeType: "text/uri-list",
                  sizeBytes: docUrl.length,
                  url: docUrl || undefined,
                });
                if (k.error && res.error) toast.error(res.error);
                else {
                  toast.success("Documentação atualizada");
                  setDocTitle("");
                  setDocUrl("");
                  router.refresh();
                }
              });
            }}
          >
            <input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Título"
              className={FORM_INPUT_CLASS}
            />
            <input
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="URL / link (opcional)"
              className={FORM_INPUT_CLASS}
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded border border-cyan-500/30 px-3 text-[12px] text-cyan-200 sm:col-span-2"
            >
              Adicionar à documentação
            </button>
          </form>

          {knowledgeDocuments.length ? (
            <ul className="space-y-2">
              {knowledgeDocuments.map((d) => (
                <li
                  key={d.id}
                  className="rounded border border-amber-500/20 px-3 py-2 text-[12px]"
                >
                  <Link
                    href={`/dashboard/knowledge/${d.id}`}
                    className="text-zinc-100 hover:text-cyan-300"
                  >
                    {d.title}
                  </Link>
                  <p className="text-[10px] text-zinc-600">
                    Knowledge · {DOCUMENT_TYPE_LABELS[d.type]}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          <ul className="space-y-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="rounded border border-white/10 px-3 py-2 text-[12px]"
              >
                <p className="text-zinc-200">{d.title}</p>
                <p className="text-[10px] text-zinc-600">
                  {d.kind} · {d.fileName}
                </p>
                {d.url ? (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    Abrir
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 text-[12px]">
            <Link
              href={`/dashboard/projects/${project.id}/documents`}
              className="text-cyan-400 hover:underline"
            >
              Anexos do projeto →
            </Link>
            <Link
              href="/dashboard/knowledge"
              className="text-amber-200/80 hover:underline"
            >
              Knowledge Hub →
            </Link>
          </div>
        </div>
      ) : null}

      {tab === "comentarios" ? (
        <CommentsPanel targetType="project" targetId={project.id} />
      ) : null}

      {tab === "membros" ? (
        <div className="space-y-3">
          <ul className="space-y-1 text-[12px]">
            {project.members.map((m) => (
              <li key={m.userId} className="flex justify-between text-zinc-300">
                <span className="truncate">{m.userId}</span>
                <span className="text-zinc-600">{m.role}</span>
              </li>
            ))}
          </ul>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await addProjectMemberAction({
                  projectId: project.id,
                  memberUserId: memberId.trim(),
                  role: "editor",
                });
                if (res.error) toast.error(res.error);
                else {
                  toast.success("Membro adicionado");
                  setMemberId("");
                  router.refresh();
                }
              });
            }}
          >
            <input
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="User ID do membro"
              className={FORM_INPUT_CLASS}
              required
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
            >
              Adicionar editor
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
