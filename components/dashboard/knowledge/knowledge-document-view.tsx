"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addKnowledgeCommentAction,
  applyKnowledgeOcrAction,
  compareKnowledgeVersionsAction,
  deleteKnowledgeCommentAction,
  editKnowledgeCommentAction,
  exportKnowledgeDocumentAction,
  linkKnowledgeRelationAction,
  listKnowledgeActivityAction,
  listKnowledgeCommentsAction,
  listKnowledgeRelationsAction,
  listKnowledgeVersionsAction,
  restoreKnowledgeVersionAction,
  updateKnowledgeDocumentAction,
} from "@/app/actions/knowledge";
import {
  DOCUMENT_TYPE_LABELS,
  OCR_STATUS_LABELS,
  type KnowledgeActivity,
  type KnowledgeComment,
  type KnowledgeDocument,
  type KnowledgeRelation,
  type KnowledgeRelationType,
  type KnowledgeVersion,
} from "@/lib/knowledge/types";
import { documentToMarkdownPreview } from "@/lib/knowledge/export";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { NoteEditor } from "@/components/dashboard/knowledge/note-editor";

export function KnowledgeDocumentView({
  document: initial,
}: {
  document: KnowledgeDocument;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [doc, setDoc] = useState(initial);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [relations, setRelations] = useState<KnowledgeRelation[]>([]);
  const [comments, setComments] = useState<KnowledgeComment[]>([]);
  const [activity, setActivity] = useState<KnowledgeActivity[]>([]);
  const [ocrText, setOcrText] = useState(initial.ocrText ?? "");
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [relType, setRelType] = useState<KnowledgeRelationType>("project");
  const [relTarget, setRelTarget] = useState("");
  const [compareA, setCompareA] = useState<number | "">("");
  const [compareB, setCompareB] = useState<number | "">("");
  const [diff, setDiff] = useState<
    { field: string; from: string; to: string }[]
  >([]);

  useEffect(() => {
    void Promise.all([
      listKnowledgeVersionsAction(doc.id),
      listKnowledgeRelationsAction(doc.id),
      listKnowledgeCommentsAction(doc.id),
      listKnowledgeActivityAction({ documentId: doc.id, limit: 30 }),
    ]).then(([v, r, c, a]) => {
      setVersions(v);
      setRelations(r);
      setComments(c);
      setActivity(a);
    });
  }, [doc.id]);

  const memories = relations.filter((r) => r.relationType === "memory");
  const discoveries = relations.filter((r) => r.relationType === "discovery");
  const entities = relations.filter((r) => r.relationType === "entity");
  const projects = relations.filter((r) => r.relationType === "project");
  const businesses = relations.filter((r) => r.relationType === "business");

  return (
    <div className="space-y-4" data-testid="knowledge-document-view">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href="/dashboard/knowledge"
            className="text-[11px] text-zinc-500 hover:text-cyan-300"
          >
            ← Knowledge Hub
          </Link>
          <h1 className="mt-1 text-lg font-medium text-zinc-100">{doc.title}</h1>
          <p className="text-[12px] text-zinc-500">
            {DOCUMENT_TYPE_LABELS[doc.type]} · {doc.visibility} · v
            {doc.currentVersion}
            {(doc.type === "pdf" ||
              doc.type === "image" ||
              doc.type === "contract") &&
              ` · OCR: ${OCR_STATUS_LABELS[doc.ocrStatus]}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["markdown", "json", "pdf"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              disabled={pending}
              className="min-h-11 rounded border border-white/10 px-2 text-[11px] text-zinc-400 md:min-h-0"
              onClick={() => {
                start(async () => {
                  const res = await exportKnowledgeDocumentAction(doc.id, fmt);
                  if (res.error || !res.payload) {
                    toast.error(res.error ?? "Export falhou");
                    return;
                  }
                  const blob = new Blob([res.payload.content], {
                    type: res.payload.mimeType,
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = res.payload.fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(`Exportado (${fmt})`);
                });
              }}
            >
              Export {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {doc.description ? (
        <p className="text-[13px] text-zinc-400">{doc.description}</p>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Resumo</h2>
        <p className="mt-1 whitespace-pre-wrap text-[13px] text-zinc-400">
          {doc.summary || "Sem resumo ainda."}
        </p>
      </section>

      {doc.type === "note" ? (
        <NoteEditor
          documentId={doc.id}
          initialTitle={doc.title}
          initialContent={doc.content}
          onSaved={(next) => setDoc(next)}
        />
      ) : (
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">Preview</h2>
          {doc.linkPreview ? (
            <div className="mt-2 space-y-2">
              {doc.linkPreview.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={doc.linkPreview.image}
                  alt=""
                  className="max-h-40 rounded border border-white/10 object-cover"
                />
              ) : null}
              <p className="text-[13px] text-zinc-100">
                {doc.linkPreview.title}
              </p>
              <p className="text-[12px] text-zinc-500">
                {doc.linkPreview.description}
              </p>
              <a
                href={doc.linkPreview.url}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-cyan-300"
              >
                {doc.linkPreview.url}
              </a>
              <p className="text-[10px] text-zinc-600">
                Origem · preview permanente ·{" "}
                {new Date(doc.linkPreview.fetchedAt).toLocaleString("pt-BR")}
              </p>
            </div>
          ) : (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[12px] text-zinc-400">
              {documentToMarkdownPreview(doc)}
            </pre>
          )}
        </section>
      )}

      {(doc.type === "pdf" ||
        doc.type === "image" ||
        doc.type === "contract") && (
        <section
          className="space-y-2 rounded-lg border border-white/[0.06] p-3"
          data-testid="knowledge-ocr-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[12px] font-medium text-zinc-300">
              OCR · {OCR_STATUS_LABELS[doc.ocrStatus]}
            </h2>
            <button
              type="button"
              disabled={pending}
              className="text-[11px] text-cyan-300"
              onClick={() => {
                start(async () => {
                  const res = await applyKnowledgeOcrAction(doc.id, {
                    ocrText: ocrText || doc.ocrText || "texto indexado",
                    confidence: 0.9,
                    reprocess: true,
                    status: "ready",
                  });
                  if (res.error || !res.document) {
                    toast.error(res.error ?? "OCR falhou");
                    return;
                  }
                  setDoc(res.document);
                  toast.success("OCR reprocessado e indexado");
                  const v = await listKnowledgeVersionsAction(doc.id);
                  setVersions(v);
                });
              }}
            >
              Reprocessar OCR
            </button>
          </div>
          <textarea
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            rows={6}
            className={`${FORM_INPUT_CLASS} py-2 font-mono text-[12px]`}
            placeholder="Texto OCR / indexação"
          />
          <button
            type="button"
            disabled={pending}
            className="min-h-11 rounded bg-cyan-500/90 px-3 text-[12px] text-zinc-950"
            onClick={() => {
              start(async () => {
                const res = await applyKnowledgeOcrAction(doc.id, {
                  ocrText,
                  status: "manual",
                  confidence: 1,
                });
                if (res.error || !res.document) {
                  toast.error(res.error ?? "Falha");
                  return;
                }
                setDoc(res.document);
                toast.success("OCR salvo");
              });
            }}
          >
            Salvar OCR
          </button>
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">
            Memórias relacionadas
          </h2>
          <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
            {memories.length ? (
              memories.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/dashboard/settings/memory#${r.targetId}`}
                    className="hover:text-cyan-300"
                  >
                    {r.label}
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-zinc-600">Nenhuma</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">
            Discovery relacionado
          </h2>
          <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
            {discoveries.length ? (
              discoveries.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/dashboard/discovery`}
                    className="hover:text-cyan-300"
                  >
                    {r.label}
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-zinc-600">Nenhum</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">Projetos</h2>
          <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
            {projects.length || doc.projectId ? (
              <>
                {doc.projectId ? (
                  <li>
                    <Link
                      href={`/dashboard/projects/${doc.projectId}`}
                      className="hover:text-cyan-300"
                    >
                      Projeto {doc.projectId}
                    </Link>
                  </li>
                ) : null}
                {projects.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/dashboard/projects/${r.targetId}`}
                      className="hover:text-cyan-300"
                    >
                      {r.label}
                    </Link>
                  </li>
                ))}
              </>
            ) : (
              <li className="text-zinc-600">Nenhum</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[12px] font-medium text-zinc-300">
            Empresas / Entidades
          </h2>
          <ul className="mt-2 space-y-1 text-[12px] text-zinc-400">
            {businesses.map((r) => (
              <li key={r.id}>
                <Link href="/dashboard/business" className="hover:text-cyan-300">
                  {r.label}
                </Link>
              </li>
            ))}
            {entities.map((r) => (
              <li key={r.id}>{r.label}</li>
            ))}
            {!businesses.length && !entities.length && !doc.businessId ? (
              <li className="text-zinc-600">Nenhuma</li>
            ) : null}
            {doc.businessId ? (
              <li>
                <Link href="/dashboard/business" className="hover:text-cyan-300">
                  Empresa {doc.businessId}
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="mb-2 text-[12px] font-medium text-zinc-300">
          Vincular
        </h2>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await linkKnowledgeRelationAction({
                documentId: doc.id,
                relationType: relType,
                targetId: relTarget.trim(),
                label: `${relType}:${relTarget.trim()}`,
              });
              if (res.error) toast.error(res.error);
              else {
                toast.success("Vínculo criado");
                setRelTarget("");
                setRelations(await listKnowledgeRelationsAction(doc.id));
                router.refresh();
              }
            });
          }}
        >
          <select
            value={relType}
            onChange={(e) =>
              setRelType(e.target.value as KnowledgeRelationType)
            }
            className={FORM_INPUT_CLASS}
          >
            {(
              [
                "project",
                "business",
                "memory",
                "entity",
                "discovery",
              ] as const
            ).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={relTarget}
            onChange={(e) => setRelTarget(e.target.value)}
            required
            placeholder="ID do alvo"
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
      </section>

      <section
        className="rounded-lg border border-white/[0.06] p-3"
        data-testid="knowledge-versions"
      >
        <h2 className="text-[12px] font-medium text-zinc-300">
          Versionamento
        </h2>
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-[12px]">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] py-1"
            >
              <span className="text-zinc-400">
                v{v.version} · {v.note} ·{" "}
                {new Date(v.createdAt).toLocaleString("pt-BR")}
              </span>
              <button
                type="button"
                className="text-cyan-300"
                onClick={() => {
                  start(async () => {
                    const res = await restoreKnowledgeVersionAction(
                      doc.id,
                      v.version
                    );
                    if (res.error || !res.document) {
                      toast.error(res.error ?? "Falha");
                      return;
                    }
                    setDoc(res.document);
                    setVersions(await listKnowledgeVersionsAction(doc.id));
                    toast.success(`Restaurado de v${v.version}`);
                  });
                }}
              >
                Restaurar
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="number"
            value={compareA}
            onChange={(e) =>
              setCompareA(e.target.value ? Number(e.target.value) : "")
            }
            placeholder="vA"
            className={`${FORM_INPUT_CLASS} w-20`}
          />
          <input
            type="number"
            value={compareB}
            onChange={(e) =>
              setCompareB(e.target.value ? Number(e.target.value) : "")
            }
            placeholder="vB"
            className={`${FORM_INPUT_CLASS} w-20`}
          />
          <button
            type="button"
            className="text-[11px] text-cyan-300"
            onClick={() => {
              if (compareA === "" || compareB === "") return;
              start(async () => {
                const res = await compareKnowledgeVersionsAction(
                  doc.id,
                  Number(compareA),
                  Number(compareB)
                );
                setDiff(res.diff);
              });
            }}
          >
            Comparar
          </button>
        </div>
        {diff.length ? (
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
            {diff.map((d) => (
              <li key={d.field}>
                <strong className="text-zinc-400">{d.field}</strong>:{" "}
                {d.from.slice(0, 80)} → {d.to.slice(0, 80)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className="rounded-lg border border-white/[0.06] p-3"
        data-testid="knowledge-comments"
      >
        <h2 className="text-[12px] font-medium text-zinc-300">Comentários</h2>
        <ul className="mt-2 space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded border border-white/[0.06] p-2 text-[12px] ${
                c.parentId ? "ml-4" : ""
              }`}
            >
              <p className="text-zinc-300">{c.body}</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                {new Date(c.createdAt).toLocaleString("pt-BR")}
                {c.editedAt ? " · editado" : ""}
              </p>
              <div className="mt-1 flex gap-2 text-[11px]">
                <button
                  type="button"
                  className="text-zinc-500"
                  onClick={() => setReplyTo(c.id)}
                >
                  Responder
                </button>
                <button
                  type="button"
                  className="text-zinc-500"
                  onClick={() => {
                    const body = window.prompt("Editar", c.body);
                    if (!body) return;
                    start(async () => {
                      await editKnowledgeCommentAction({
                        commentId: c.id,
                        body,
                        documentId: doc.id,
                      });
                      setComments(await listKnowledgeCommentsAction(doc.id));
                    });
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="text-rose-400/80"
                  onClick={() => {
                    start(async () => {
                      await deleteKnowledgeCommentAction({
                        commentId: c.id,
                        documentId: doc.id,
                      });
                      setComments(await listKnowledgeCommentsAction(doc.id));
                    });
                  }}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await addKnowledgeCommentAction({
                documentId: doc.id,
                body: commentBody,
                parentId: replyTo,
              });
              if (res.error) toast.error(res.error);
              else {
                setCommentBody("");
                setReplyTo(null);
                setComments(await listKnowledgeCommentsAction(doc.id));
              }
            });
          }}
        >
          {replyTo ? (
            <p className="text-[10px] text-zinc-500">
              Respondendo {replyTo}{" "}
              <button type="button" onClick={() => setReplyTo(null)}>
                cancelar
              </button>
            </p>
          ) : null}
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            required
            rows={2}
            className={`${FORM_INPUT_CLASS} py-2`}
            placeholder="Comentar…"
          />
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded bg-cyan-500/90 px-3 text-[12px] text-zinc-950"
          >
            Comentar
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[12px] font-medium text-zinc-300">Timeline</h2>
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-[12px] text-zinc-500">
          {activity.map((a) => (
            <li key={a.id}>
              <span className="text-zinc-400">{a.kind}</span> · {a.title} ·{" "}
              {new Date(a.createdAt).toLocaleString("pt-BR")}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        className="text-[11px] text-zinc-500"
        onClick={() => {
          start(async () => {
            const res = await updateKnowledgeDocumentAction({
              documentId: doc.id,
              title: doc.title,
              description: doc.description,
              softSave: false,
              versionNote: "checkpoint manual",
            });
            if (res.document) {
              setDoc(res.document);
              setVersions(await listKnowledgeVersionsAction(doc.id));
              toast.success("Nova versão registrada");
            }
          });
        }}
      >
        Criar checkpoint de versão
      </button>
    </div>
  );
}
