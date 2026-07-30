"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  autosaveNoteAction,
  updateKnowledgeDocumentAction,
} from "@/app/actions/knowledge";
import type { KnowledgeDocument } from "@/lib/knowledge/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";

/**
 * Simple Markdown note editor with autosave + explicit version checkpoint.
 */
export function NoteEditor({
  documentId,
  initialTitle,
  initialContent,
  onSaved,
}: {
  documentId: string;
  initialTitle: string;
  initialContent: string;
  onSaved?: (doc: KnowledgeDocument) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      start(async () => {
        setStatus("saving");
        const res = await autosaveNoteAction({
          documentId,
          title,
          content,
        });
        if (res.error || !res.document) {
          toast.error(res.error ?? "Autosave falhou");
          setStatus("idle");
          return;
        }
        setStatus("saved");
        onSaved?.(res.document);
      });
    }, 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, content, documentId, onSaved]);

  return (
    <section
      className="space-y-2 rounded-lg border border-white/[0.06] p-3"
      data-testid="knowledge-note-editor"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[12px] font-medium text-zinc-300">
          Editor Markdown
        </h2>
        <span className="text-[10px] text-zinc-600">
          {status === "saving"
            ? "salvando…"
            : status === "saved"
              ? "autosave ok"
              : "pronto"}
        </span>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={FORM_INPUT_CLASS}
        placeholder="Título"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={14}
        className={`${FORM_INPUT_CLASS} py-2 font-mono text-[12px] leading-relaxed`}
        placeholder="Escreva em Markdown…"
      />
      <button
        type="button"
        disabled={pending}
        className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
        onClick={() => {
          start(async () => {
            const res = await updateKnowledgeDocumentAction({
              documentId,
              title,
              content,
              summary: content.slice(0, 280),
              softSave: false,
              versionNote: "checkpoint nota",
            });
            if (res.error || !res.document) {
              toast.error(res.error ?? "Falha");
              return;
            }
            onSaved?.(res.document);
            toast.success("Versão salva no histórico");
          });
        }}
      >
        Salvar versão
      </button>
    </section>
  );
}
