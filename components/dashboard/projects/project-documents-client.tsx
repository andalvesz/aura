"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addProjectDocumentAction,
  searchProjectDocumentsAction,
} from "@/app/actions/projects";
import type { ProjectDocument } from "@/lib/projects/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";

export function ProjectDocumentsClient({
  projectId,
  initial,
}: {
  projectId: string;
  initial: ProjectDocument[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState(initial);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"link" | "pdf" | "image" | "audio" | "file">(
    "link"
  );

  return (
    <div className="space-y-4" data-testid="project-documents">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (query.trim().length < 2) {
              setDocs(initial);
              return;
            }
            const hits = await searchProjectDocumentsAction(
              query.trim(),
              projectId
            );
            setDocs(hits);
          });
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar documentos, OCR, links…"
          className={FORM_INPUT_CLASS}
        />
        <button
          type="submit"
          className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
        >
          Buscar
        </button>
      </form>

      <form
        className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addProjectDocumentAction({
              projectId,
              kind,
              title: title || url || "documento",
              fileName: title || "arquivo",
              mimeType:
                kind === "link"
                  ? "text/uri-list"
                  : kind === "pdf"
                    ? "application/pdf"
                    : kind === "image"
                      ? "image/jpeg"
                      : kind === "audio"
                        ? "audio/mpeg"
                        : "application/octet-stream",
              sizeBytes: (url || title).length,
              url: url || null,
            });
            if (res.error) toast.error(res.error);
            else {
              toast.success("Documento adicionado");
              setTitle("");
              setUrl("");
              router.refresh();
            }
          });
        }}
      >
        <p className="text-[12px] text-zinc-400 sm:col-span-2">Anexar</p>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className={FORM_INPUT_CLASS}
        >
          <option value="link">Link</option>
          <option value="pdf">PDF</option>
          <option value="image">Imagem</option>
          <option value="audio">Áudio</option>
          <option value="file">Arquivo</option>
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título"
          className={FORM_INPUT_CLASS}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL"
          className={`${FORM_INPUT_CLASS} sm:col-span-2`}
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950 sm:col-span-2"
        >
          Salvar anexo
        </button>
      </form>

      {!docs.length ? (
        <p className="text-center text-[13px] text-zinc-500">
          Nenhum documento neste projeto.
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-2"
            >
              <p className="text-[13px] text-zinc-100">{d.title}</p>
              <p className="text-[10px] text-zinc-600">
                {d.kind} · {d.fileName}
              </p>
              {d.ocrText ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
                  OCR: {d.ocrText}
                </p>
              ) : null}
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-cyan-400 hover:underline"
                >
                  Abrir
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
