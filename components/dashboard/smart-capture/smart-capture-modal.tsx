"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, X, Paperclip, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { smartCaptureAction, suggestTagsAction } from "@/app/actions/smart-capture";
import { useAuraContext } from "@/components/dashboard/aura-context-provider";
import { useSmartCapture } from "@/components/dashboard/smart-capture/smart-capture-context";
import { CascadeProgressPanel } from "@/components/dashboard/smart-capture/cascade-progress-panel";
import { CapturePreviewCard } from "@/components/dashboard/smart-capture/capture-preview-card";
import { UploadProgressList } from "@/components/dashboard/smart-capture/upload-progress-list";
import { buildAttachmentPreview } from "@/lib/smart-capture/preview";
import {
  cascadeProgressFromReport,
  initialCascadeProgress,
  markCascadeStep,
} from "@/lib/smart-capture/cascade-progress";
import {
  cancelUpload,
  completeUpload,
  createUploadProgress,
  failUpload,
  retryUpload,
  runParallelUploads,
  startUpload,
  tickUpload,
} from "@/lib/smart-capture/upload";
import { compressImageBlob } from "@/lib/smart-capture/compress";
import {
  enqueueOfflineCapture,
  emitSmartCaptureSyncEvent,
} from "@/lib/smart-capture/offline-queue";
import {
  detectVideoLink,
  isHttpUrl,
  type CaptureAttachmentInput,
  type CascadeProgressStep,
  type FavoritePinSurface,
  type LinkPreview,
  type UploadProgress,
} from "@/lib/smart-capture/types";
import type { VisibilityScope } from "@/lib/aura-brain/visibility";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";

export function QuickCaptureFab() {
  const { open, openCapture, closeCapture } = useSmartCapture();

  return (
    <>
      <button
        type="button"
        data-testid="quick-capture-fab"
        aria-label="Nova memória"
        onClick={() => openCapture()}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/90 px-4 py-3 text-[13px] font-medium text-cyan-100 shadow-lg backdrop-blur hover:bg-cyan-900/90 md:bottom-6 md:right-6"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">Capturar</span>
      </button>
      {open ? <SmartCaptureModal onClose={closeCapture} /> : null}
    </>
  );
}

function SmartCaptureModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const aura = useAuraContext();
  const isOnline = useOnlineStatus();
  const {
    pendingFiles,
    initialText,
    initialLinks,
    seedAttachments,
    clearPending,
  } = useSmartCapture();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(initialText);
  const [linkInput, setLinkInput] = useState(initialLinks.join("\n"));
  const [tags, setTags] = useState("");
  const [suggested, setSuggested] = useState<string[]>([]);
  const [acceptedSuggested, setAcceptedSuggested] = useState<string[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [attachments, setAttachments] = useState<CaptureAttachmentInput[]>(
    seedAttachments
  );
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [cascadeSteps, setCascadeSteps] = useState<CascadeProgressStep[]>(
    initialCascadeProgress()
  );
  const [showCascade, setShowCascade] = useState(false);
  const [visibility, setVisibility] = useState<VisibilityScope>("PRIVATE");
  const [useWorkspace, setUseWorkspace] = useState(
    aura.activeContext === "workspace"
  );
  const [pins, setPins] = useState<FavoritePinSurface[]>([]);
  const abortMap = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  useEffect(() => {
    if (pendingFiles.length) {
      void ingestFiles(pendingFiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const urls = linkInput
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(isHttpUrl);
    if (!urls.length) {
      setLinkPreviews([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const previews: LinkPreview[] = [];
      for (const url of urls.slice(0, 5)) {
        try {
          const res = await fetch("/api/smart-capture/link-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          const data = (await res.json()) as { preview?: LinkPreview };
          if (data.preview) previews.push(data.preview);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setLinkPreviews(previews);
    })();
    return () => {
      cancelled = true;
    };
  }, [linkInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      void suggestTagsAction({
        title,
        description,
        ocrText,
        links: linkInput.split(/\n|,/).map((s) => s.trim()).filter(Boolean),
        fileNames: attachments.map((a) => a.fileName),
        existingTags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      }).then((s) => {
        setSuggested(s);
        setAcceptedSuggested((prev) =>
          prev.filter((p) => s.includes(p) || prev.includes(p))
        );
      });
    }, 300);
    return () => clearTimeout(t);
  }, [title, description, ocrText, linkInput, attachments, tags]);

  async function ingestFiles(files: File[]) {
    const progressItems = files.map((f) =>
      createUploadProgress(f.name, f.size)
    );
    setUploads((prev) => [...progressItems, ...prev]);

    await runParallelUploads(files, async (file, index) => {
      const progressId = progressItems[index].id;
      const controller = new AbortController();
      abortMap.current.set(progressId, controller);

      setUploads((prev) =>
        prev.map((u) => (u.id === progressId ? startUpload(u) : u))
      );

      try {
        let blob: Blob = file;
        if (file.type.startsWith("image/")) {
          blob = await compressImageBlob(file);
        }
        setUploads((prev) =>
          prev.map((u) =>
            u.id === progressId
              ? tickUpload({ ...u, bytesTotal: blob.size }, blob.size * 0.4)
              : u
          )
        );

        const form = new FormData();
        form.append(
          "file",
          new File([blob], file.name, { type: file.type || blob.type })
        );
        form.append("ocr", "1");

        const res = await fetch("/api/smart-capture/upload", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          error?: string;
          attachment?: CaptureAttachmentInput;
        };
        if (!res.ok || !data.attachment) {
          throw new Error(data.error ?? "Upload falhou");
        }

        setUploads((prev) =>
          prev.map((u) => (u.id === progressId ? completeUpload(u) : u))
        );
        setAttachments((prev) => [...prev, data.attachment!]);
        if (data.attachment.ocrText) {
          setOcrText((prev) =>
            prev
              ? `${prev}\n\n${data.attachment!.ocrText}`
              : data.attachment!.ocrText!
          );
        }
        if (!description.trim() && data.attachment.ocrText) {
          setDescription(data.attachment.ocrText.slice(0, 500));
        }
      } catch (e) {
        if (controller.signal.aborted) {
          setUploads((prev) =>
            prev.map((u) => (u.id === progressId ? cancelUpload(u) : u))
          );
          return;
        }
        setUploads((prev) =>
          prev.map((u) =>
            u.id === progressId
              ? failUpload(u, e instanceof Error ? e.message : "Erro")
              : u
          )
        );
      } finally {
        abortMap.current.delete(progressId);
      }
    });
  }

  function togglePin(surface: FavoritePinSurface) {
    setPins((prev) =>
      prev.includes(surface)
        ? prev.filter((p) => p !== surface)
        : [...prev, surface]
    );
  }

  function toggleSuggested(tag: string) {
    setAcceptedSuggested((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Smart Capture"
      data-testid="quick-capture-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:rounded-xl"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const links = linkInput
              .split(/\n|,/)
              .map((s) => s.trim())
              .filter(isHttpUrl);

            const rich: CaptureAttachmentInput[] = [
              ...attachments,
              ...linkPreviews.map((p) => ({
                kind: (detectVideoLink(p.url) ? "video_link" : "link") as
                  | "link"
                  | "video_link",
                fileName: p.title ?? p.url,
                mimeType: "text/uri-list",
                sizeBytes: p.url.length,
                url: p.url,
                linkPreview: p,
              })),
            ];

            const payload = {
              title: title.trim() || undefined,
              description:
                description.trim() ||
                ocrText.trim() ||
                rich[0]?.fileName ||
                "",
              ocrText: ocrText.trim() || undefined,
              attachments: rich,
              links,
              tags: tags
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              suggestedTags: suggested,
              acceptedSuggestedTags: acceptedSuggested,
              visibility: useWorkspace ? ("WORKSPACE" as const) : visibility,
              workspaceId: useWorkspace ? aura.activeWorkspaceId : null,
              shareWithWorkspace: useWorkspace,
              pinTo: pins,
              source: "quick_capture" as const,
            };

            if (!payload.description) {
              toast.error("Informe texto, OCR ou anexo");
              return;
            }

            if (!isOnline) {
              const { createClient } = await import("@/lib/supabase/client");
              const supabase = createClient();
              const { data } = await supabase.auth.getUser();
              const uid = data.user?.id ?? "anonymous";
              enqueueOfflineCapture(uid, payload);
              emitSmartCaptureSyncEvent();
              toast.success("Salvo offline — sincroniza ao voltar a internet");
              clearPending();
              onClose();
              return;
            }

            setShowCascade(true);
            setCascadeSteps(markCascadeStep(initialCascadeProgress(), "memory", "running"));

            const res = await smartCaptureAction(payload);
            if (res.error) {
              toast.error(res.error);
              setShowCascade(false);
              return;
            }

            if (res.cascade) {
              setCascadeSteps(cascadeProgressFromReport(res.cascade));
            }

            toast.success(
              res.cascade?.discoveryGenerated
                ? `Capturado · ${res.cascade.discoveryGenerated} descoberta(s)`
                : "Captura salva na Inbox"
            );
            clearPending();
            onClose();
            router.push("/dashboard/inbox");
            router.refresh();
          });
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-medium text-zinc-100">
              Smart Capture
            </h2>
            <p className="text-[11px] text-zinc-500">
              Texto · imagem · PDF · áudio · link · vídeo · &lt;10s
              {!isOnline ? " · offline" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="mb-2 block space-y-1">
          <span className="text-[10px] text-zinc-600">Título (opcional)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={FORM_INPUT_CLASS}
            placeholder="Resumo curto"
          />
        </label>

        <label className="mb-2 block space-y-1">
          <span className="text-[10px] text-zinc-600">Descrição</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${FORM_INPUT_CLASS} min-h-[5rem] py-2`}
            placeholder="O que aconteceu? Cole um link ou anexe arquivo…"
            autoFocus
          />
        </label>

        {ocrText ? (
          <label className="mb-2 block space-y-1">
            <span className="text-[10px] text-zinc-600">
              Texto OCR (editável)
            </span>
            <textarea
              value={ocrText}
              onChange={(e) => setOcrText(e.target.value)}
              rows={3}
              className={`${FORM_INPUT_CLASS} min-h-[4rem] py-2`}
              data-testid="ocr-edit"
            />
          </label>
        ) : null}

        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-3.5" />
            Anexar
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,audio/*,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void ingestFiles(files);
              e.target.value = "";
            }}
          />
        </div>

        <UploadProgressList
          items={uploads}
          onCancel={(id) => {
            abortMap.current.get(id)?.abort();
            setUploads((prev) =>
              prev.map((u) => (u.id === id ? cancelUpload(u) : u))
            );
          }}
          onRetry={(id) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === id ? retryUpload(u) : u))
            );
          }}
        />

        {attachments.length ? (
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            {attachments.map((a, i) => (
              <CapturePreviewCard key={`${a.fileName}-${i}`} preview={buildAttachmentPreview(a)} />
            ))}
          </div>
        ) : null}

        <label className="mb-2 block space-y-1">
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Link2 className="size-3" /> Links / vídeo
          </span>
          <textarea
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            rows={2}
            className={`${FORM_INPUT_CLASS} py-2 text-[12px]`}
            placeholder="Cole URLs (um por linha)"
          />
        </label>

        {linkPreviews.length ? (
          <div className="mb-2 space-y-2">
            {linkPreviews.map((p) => (
              <CapturePreviewCard
                key={p.url}
                preview={{ kind: "link", preview: p }}
              />
            ))}
          </div>
        ) : null}

        <label className="mb-2 block space-y-1">
          <span className="text-[10px] text-zinc-600">Tags manuais</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={FORM_INPUT_CLASS}
            placeholder="viagem, finanças"
          />
        </label>

        {suggested.length ? (
          <div className="mb-3" data-testid="suggested-tags">
            <p className="mb-1 text-[10px] text-zinc-600">
              Tags sugeridas (opcional)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggested.map((tag) => {
                const on = acceptedSuggested.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSuggested(tag)}
                    className={`rounded border px-2 py-1 text-[11px] ${
                      on
                        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                        : "border-white/10 text-zinc-400"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <label className="flex min-h-11 items-center gap-2 rounded border border-white/10 px-2.5 py-2 text-[12px] text-zinc-300">
            <input
              type="checkbox"
              checked={useWorkspace}
              onChange={(e) => {
                setUseWorkspace(e.target.checked);
                if (e.target.checked) setVisibility("WORKSPACE");
                else setVisibility("PRIVATE");
              }}
              disabled={!aura.activeWorkspaceId}
            />
            Compartilhar no workspace
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-zinc-600">Visibilidade</span>
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as VisibilityScope)
              }
              disabled={useWorkspace}
              className={FORM_INPUT_CLASS}
            >
              <option value="PRIVATE">Privada</option>
              <option value="WORKSPACE">Workspace</option>
            </select>
          </label>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5" data-testid="pin-surfaces">
          {(
            [
              ["home", "Fixar na Home"],
              ["search", "Fixar na Busca"],
              ["feed", "Fixar no Feed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => togglePin(id)}
              className={`rounded border px-2 py-1 text-[10px] ${
                pins.includes(id)
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-white/10 text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <CascadeProgressPanel steps={cascadeSteps} visible={showCascade} />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={
              pending ||
              (!description.trim() && !ocrText.trim() && !attachments.length)
            }
            className="min-h-11 rounded bg-cyan-500/90 px-4 py-2 text-[13px] font-medium text-zinc-950 disabled:opacity-40"
          >
            {pending ? "Salvando…" : isOnline ? "Salvar" : "Salvar offline"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded border border-white/10 px-3 py-2 text-[12px] text-zinc-400"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
