"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createBusinessAction } from "@/app/actions/projects";
import { listBusinessKnowledgeDocumentsAction } from "@/app/actions/knowledge";
import type { BusinessCompany, BusinessSegment } from "@/lib/projects/types";
import type { KnowledgeDocument } from "@/lib/knowledge/types";
import { DOCUMENT_TYPE_LABELS } from "@/lib/knowledge/types";
import { BUSINESS_SEGMENT_LABELS } from "@/lib/projects/business";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { CreateProjectForm } from "@/components/dashboard/projects/projects-board";

export function BusinessHubClient({
  businesses,
  projectsByBusiness,
}: {
  businesses: BusinessCompany[];
  projectsByBusiness: Record<string, Array<{ id: string; name: string }>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<BusinessSegment>("other");
  const [description, setDescription] = useState("");
  const [selectedBiz, setSelectedBiz] = useState<string | null>(null);
  const [docsByBiz, setDocsByBiz] = useState<
    Record<string, KnowledgeDocument[]>
  >({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, KnowledgeDocument[]> = {};
      for (const b of businesses) {
        try {
          next[b.id] = await listBusinessKnowledgeDocumentsAction(b.id);
        } catch {
          next[b.id] = [];
        }
      }
      if (!cancelled) setDocsByBiz(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [businesses]);

  return (
    <div className="space-y-4" data-testid="business-hub">
      <form
        className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createBusinessAction({
              name,
              segment,
              description,
            });
            if (res.error || !res.business) {
              toast.error(res.error ?? "Falha");
              return;
            }
            toast.success("Empresa criada");
            setName("");
            setDescription("");
            router.refresh();
          });
        }}
      >
        <p className="text-[12px] font-medium text-zinc-200 sm:col-span-2">
          Nova empresa
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Nome"
          className={FORM_INPUT_CLASS}
        />
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value as BusinessSegment)}
          className={FORM_INPUT_CLASS}
        >
          {(Object.keys(BUSINESS_SEGMENT_LABELS) as BusinessSegment[]).map(
            (s) => (
              <option key={s} value={s}>
                {BUSINESS_SEGMENT_LABELS[s]}
              </option>
            )
          )}
        </select>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Descrição / segmento"
          className={`${FORM_INPUT_CLASS} py-2 sm:col-span-2`}
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950 sm:col-span-2"
        >
          Criar empresa
        </button>
      </form>

      {!businesses.length ? (
        <p className="text-center text-[13px] text-zinc-500">
          Nenhuma empresa no workspace ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {businesses.map((b) => {
            const docs = docsByBiz[b.id] ?? [];
            const contracts = docs.filter(
              (d) => d.type === "contract" || d.tags.includes("contrato")
            );
            const links = docs.filter((d) => d.type === "link");
            const files = docs.filter((d) =>
              ["pdf", "image", "file", "audio"].includes(d.type)
            );
            return (
              <li
                key={b.id}
                className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] text-zinc-100">{b.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {BUSINESS_SEGMENT_LABELS[b.segment]} ·{" "}
                      {b.description || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] text-cyan-400"
                    onClick={() =>
                      setSelectedBiz(selectedBiz === b.id ? null : b.id)
                    }
                  >
                    + Projeto
                  </button>
                </div>
                <ul className="mt-2 space-y-1">
                  {(projectsByBusiness[b.id] ?? []).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/dashboard/projects/${p.id}`}
                        className="text-[12px] text-zinc-300 hover:text-cyan-300"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                  {!(projectsByBusiness[b.id] ?? []).length ? (
                    <li className="text-[11px] text-zinc-600">Sem projetos</li>
                  ) : null}
                </ul>

                <div
                  className="mt-3 space-y-2 border-t border-white/[0.04] pt-2"
                  data-testid="business-knowledge"
                >
                  <p className="text-[11px] font-medium text-zinc-400">
                    Documentos · Contratos · Arquivos · Links
                  </p>
                  {!docs.length ? (
                    <p className="text-[11px] text-zinc-600">
                      Sem conhecimento vinculado — use o{" "}
                      <Link
                        href="/dashboard/knowledge"
                        className="text-cyan-400"
                      >
                        Knowledge Hub
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="space-y-1 text-[12px]">
                      {contracts.map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/dashboard/knowledge/${d.id}`}
                            className="text-amber-100/90 hover:text-cyan-300"
                          >
                            Contrato · {d.title}
                          </Link>
                        </li>
                      ))}
                      {files.map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/dashboard/knowledge/${d.id}`}
                            className="text-zinc-300 hover:text-cyan-300"
                          >
                            {DOCUMENT_TYPE_LABELS[d.type]} · {d.title}
                          </Link>
                        </li>
                      ))}
                      {links.map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/dashboard/knowledge/${d.id}`}
                            className="text-zinc-300 hover:text-cyan-300"
                          >
                            Link · {d.title}
                          </Link>
                        </li>
                      ))}
                      {docs
                        .filter(
                          (d) =>
                            !contracts.includes(d) &&
                            !files.includes(d) &&
                            !links.includes(d)
                        )
                        .map((d) => (
                          <li key={d.id}>
                            <Link
                              href={`/dashboard/knowledge/${d.id}`}
                              className="text-zinc-300 hover:text-cyan-300"
                            >
                              {DOCUMENT_TYPE_LABELS[d.type]} · {d.title}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                {selectedBiz === b.id ? (
                  <div className="mt-3">
                    <CreateProjectForm businessId={b.id} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
