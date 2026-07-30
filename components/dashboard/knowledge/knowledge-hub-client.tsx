"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addDocumentToCollectionAction,
  createKnowledgeCollectionAction,
  createKnowledgeDocumentAction,
  createLinkAction,
  createNoteAction,
  listKnowledgeDocumentsAction,
  searchKnowledgeAction,
  updateKnowledgeDocumentAction,
} from "@/app/actions/knowledge";
import {
  DOCUMENT_TYPE_LABELS,
  OCR_STATUS_LABELS,
  type KnowledgeCollection,
  type KnowledgeDocument,
  type KnowledgeDocumentType,
} from "@/lib/knowledge/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { EmptyState } from "@/components/dashboard/empty-state";

type HubTab =
  | "all"
  | "notes"
  | "links"
  | "files"
  | "favorites"
  | "archived"
  | "collections";

export function KnowledgeHubClient({
  initialDocuments,
  initialTotal,
  collections,
}: {
  initialDocuments: KnowledgeDocument[];
  initialTotal: number;
  collections: KnowledgeCollection[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<HubTab>("all");
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState(initialDocuments);
  const [total, setTotal] = useState(initialTotal);
  const [cols, setCols] = useState(collections);
  const [offset, setOffset] = useState(0);

  const [noteTitle, setNoteTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [fileKind, setFileKind] = useState<KnowledgeDocumentType>("pdf");
  const [colName, setColName] = useState("");

  const filteredHint = useMemo(() => {
    if (tab === "notes") return "Notas Markdown";
    if (tab === "links") return "Links com preview";
    if (tab === "files") return "PDFs, imagens e arquivos";
    if (tab === "favorites") return "Favoritos";
    if (tab === "archived") return "Arquivados";
    if (tab === "collections") return "Coleções e pastas";
    return "Todo o conhecimento do workspace";
  }, [tab]);

  function refreshList(nextTab: HubTab = tab, nextOffset = 0, q = query) {
    start(async () => {
      if (q.trim().length >= 2) {
        const type =
          nextTab === "notes"
            ? "note"
            : nextTab === "links"
              ? "link"
              : undefined;
        const res = await searchKnowledgeAction(q.trim(), {
          limit: 40,
          offset: nextOffset,
          type,
        });
        let items = res.hits.map((h) => h.document);
        if (nextTab === "favorites") items = items.filter((d) => d.favorite);
        if (nextTab === "archived") items = items.filter((d) => d.archived);
        if (nextTab === "files") {
          items = items.filter((d) =>
            ["pdf", "image", "file", "audio", "contract"].includes(d.type)
          );
        }
        setDocs(items);
        setTotal(res.total);
        setOffset(nextOffset);
        return;
      }

      const opts: Parameters<typeof listKnowledgeDocumentsAction>[0] = {
        limit: 40,
        offset: nextOffset,
        includeArchived: nextTab === "archived",
        favoriteOnly: nextTab === "favorites",
      };
      if (nextTab === "notes") opts.type = "note";
      if (nextTab === "links") opts.type = "link";
      if (nextTab === "archived") opts.includeArchived = true;

      const res = await listKnowledgeDocumentsAction(opts);
      let items = res.items;
      if (nextTab === "files") {
        items = items.filter((d) =>
          ["pdf", "image", "file", "audio", "contract"].includes(d.type)
        );
      }
      if (nextTab === "archived") {
        items = items.filter((d) => d.archived);
      }
      setDocs(items);
      setTotal(res.total);
      setOffset(nextOffset);
    });
  }

  const tabs: { id: HubTab; label: string }[] = [
    { id: "all", label: "Tudo" },
    { id: "notes", label: "Notas" },
    { id: "links", label: "Links" },
    { id: "files", label: "Arquivos" },
    { id: "favorites", label: "Favoritos" },
    { id: "archived", label: "Arquivados" },
    { id: "collections", label: "Coleções" },
  ];

  return (
    <div className="space-y-4" data-testid="knowledge-hub">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              refreshList(t.id, 0);
            }}
            className={`min-h-11 rounded border px-2.5 text-[11px] md:min-h-0 ${
              tab === t.id
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                : "border-white/10 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-zinc-500">{filteredHint}</p>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          refreshList(tab, 0, query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar OCR, notas, documentos, links, comentários, tags…"
          className={FORM_INPUT_CLASS}
          data-testid="knowledge-search"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
        >
          Buscar
        </button>
      </form>

      {tab !== "collections" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <form
            className="space-y-2 rounded-lg border border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createNoteAction({
                  title: noteTitle || "Nova nota",
                  content: "",
                });
                if (res.error || !res.document) {
                  toast.error(res.error ?? "Falha");
                  return;
                }
                toast.success("Nota criada");
                setNoteTitle("");
                router.push(`/dashboard/knowledge/${res.document.id}`);
              });
            }}
          >
            <p className="text-[12px] font-medium text-zinc-200">Nova nota</p>
            <input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Título"
              className={FORM_INPUT_CLASS}
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 w-full rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950"
            >
              Criar nota
            </button>
          </form>

          <form
            className="space-y-2 rounded-lg border border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createLinkAction({ url: linkUrl });
                if (res.error || !res.document) {
                  toast.error(res.error ?? "Falha");
                  return;
                }
                toast.success("Link salvo com preview");
                setLinkUrl("");
                router.refresh();
                refreshList(tab, 0);
              });
            }}
          >
            <p className="text-[12px] font-medium text-zinc-200">Salvar link</p>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              required
              type="url"
              placeholder="https://…"
              className={FORM_INPUT_CLASS}
            />
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 w-full rounded border border-emerald-500/40 px-3 text-[13px] text-emerald-200"
            >
              Salvar preview
            </button>
          </form>

          <form
            className="space-y-2 rounded-lg border border-white/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createKnowledgeDocumentAction({
                  title: fileTitle || "Documento",
                  type: fileKind,
                  fileName: fileTitle || "arquivo",
                  mimeType:
                    fileKind === "pdf"
                      ? "application/pdf"
                      : fileKind === "image"
                        ? "image/jpeg"
                        : "application/octet-stream",
                  ocrStatus: "pending",
                });
                if (res.error || !res.document) {
                  toast.error(res.error ?? "Falha");
                  return;
                }
                toast.success("Documento criado (OCR pendente)");
                setFileTitle("");
                router.push(`/dashboard/knowledge/${res.document.id}`);
              });
            }}
          >
            <p className="text-[12px] font-medium text-zinc-200">
              Documento / anexo
            </p>
            <input
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
              placeholder="Título"
              className={FORM_INPUT_CLASS}
            />
            <select
              value={fileKind}
              onChange={(e) =>
                setFileKind(e.target.value as KnowledgeDocumentType)
              }
              className={FORM_INPUT_CLASS}
            >
              {(["pdf", "image", "file", "audio", "contract"] as const).map(
                (k) => (
                  <option key={k} value={k}>
                    {DOCUMENT_TYPE_LABELS[k]}
                  </option>
                )
              )}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="min-h-11 w-full rounded border border-white/10 px-3 text-[13px] text-zinc-200"
            >
              Adicionar
            </button>
          </form>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 rounded-lg border border-white/10 p-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createKnowledgeCollectionAction({
                name: colName,
                kind: "collection",
              });
              if (res.error || !res.collection) {
                toast.error(res.error ?? "Falha");
                return;
              }
              toast.success("Coleção criada");
              setColName("");
              setCols((c) => [res.collection!, ...c]);
            });
          }}
        >
          <input
            value={colName}
            onChange={(e) => setColName(e.target.value)}
            required
            placeholder="Nome da coleção ou pasta"
            className={FORM_INPUT_CLASS}
          />
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950"
          >
            Criar coleção
          </button>
        </form>
      )}

      {tab === "collections" ? (
        <ul className="space-y-2" data-testid="knowledge-collections">
          {!cols.length ? (
            <EmptyState
              title="Nenhuma coleção"
              description="Organize documentos em coleções e pastas."
            />
          ) : (
            cols.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] text-zinc-100">{c.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {c.kind} · {c.documentIds.length} docs
                    </p>
                  </div>
                  {docs[0] ? (
                    <button
                      type="button"
                      className="text-[11px] text-cyan-300"
                      onClick={() => {
                        start(async () => {
                          const res = await addDocumentToCollectionAction(
                            c.id,
                            docs[0].id
                          );
                          if (res.error) toast.error(res.error);
                          else {
                            toast.success("Adicionado à coleção");
                            router.refresh();
                          }
                        });
                      }}
                    >
                      + doc recente
                    </button>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      ) : !docs.length ? (
        <EmptyState
          title="Nenhum documento"
          description="Crie notas, salve links ou adicione arquivos para alimentar o conhecimento."
        />
      ) : (
        <ul className="space-y-2" data-testid="knowledge-document-list">
          {docs.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/knowledge/${d.id}`}
                    className="text-[13px] text-zinc-100 hover:text-cyan-300"
                  >
                    {d.favorite ? "★ " : ""}
                    {d.title}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                    {d.summary || d.description || DOCUMENT_TYPE_LABELS[d.type]}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-zinc-600">
                    <span>{DOCUMENT_TYPE_LABELS[d.type]}</span>
                    <span>·</span>
                    <span>{d.visibility}</span>
                    {(d.type === "pdf" ||
                      d.type === "image" ||
                      d.type === "contract") && (
                      <>
                        <span>·</span>
                        <span>OCR: {OCR_STATUS_LABELS[d.ocrStatus]}</span>
                      </>
                    )}
                    {d.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded border border-white/10 px-1 text-zinc-500"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="text-[11px] text-amber-200/80"
                    onClick={() => {
                      start(async () => {
                        await updateKnowledgeDocumentAction({
                          documentId: d.id,
                          favorite: !d.favorite,
                          softSave: true,
                        });
                        refreshList(tab, offset);
                        router.refresh();
                      });
                    }}
                  >
                    {d.favorite ? "Desfavoritar" : "Favoritar"}
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-zinc-500"
                    onClick={() => {
                      start(async () => {
                        await updateKnowledgeDocumentAction({
                          documentId: d.id,
                          archived: !d.archived,
                          softSave: true,
                        });
                        refreshList(tab, offset);
                        router.refresh();
                      });
                    }}
                  >
                    {d.archived ? "Desarquivar" : "Arquivar"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab !== "collections" && total > docs.length + offset ? (
        <button
          type="button"
          disabled={pending}
          className="min-h-11 w-full rounded border border-white/10 text-[12px] text-zinc-400"
          onClick={() => refreshList(tab, offset + 40)}
        >
          Carregar mais ({total} no total)
        </button>
      ) : null}

      <p className="text-center text-[10px] text-zinc-600">
        executionInfluence: none · Knowledge Hub RC4.1
      </p>
    </div>
  );
}
