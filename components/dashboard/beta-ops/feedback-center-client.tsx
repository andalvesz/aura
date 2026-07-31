"use client";

import { useState, useTransition } from "react";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { submitFeedbackAction } from "@/app/actions/beta-ops";
import type { FeedbackItem, FeedbackType } from "@/lib/beta-ops/types";

const TYPES: FeedbackType[] = [
  "BUG",
  "IDEA",
  "CONFUSING",
  "SLOW",
  "MISSING_FEATURE",
  "POSITIVE",
  "OTHER",
];

type Props = { initial: FeedbackItem[] };

export function FeedbackCenterClient({ initial }: Props) {
  const [items, setItems] = useState(initial);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<FeedbackType>("IDEA");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-testid="feedback-center">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Feedback" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Feedback Center</h1>
        <p className="text-[12px] text-zinc-500">
          Bugs, ideias e sinais de experiência — sem conteúdo privado.
        </p>
      </div>

      <form
        className="space-y-2 border border-white/[0.06] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await submitFeedbackAction({
              title,
              description,
              type,
              route:
                typeof window !== "undefined" ? window.location.pathname : "/dashboard/feedback",
            });
            if (!res.ok) {
              setMsg(res.error ?? "erro");
              return;
            }
            setMsg("Enviado");
            setTitle("");
            setDescription("");
            setItems((prev) => [
              {
                id: String((res.data as { id: string }).id),
                title,
                description,
                type,
                severity: "low",
                targetKind: "general",
                route: "/dashboard/feedback",
                context: {},
                screenshotReference: null,
                browserMetadata: {},
                deviceMetadata: {},
                correlationId: res.correlationId ?? null,
                status: "NEW",
                priority: 0,
                assigneeId: null,
                linkedReleaseId: null,
                duplicateOfId: null,
                internalNotes: "",
                createdBy: "me",
                workspaceId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                softDeleted: false,
              },
              ...prev,
            ]);
          });
        }}
      >
        <select
          className="w-full rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[12px]"
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackType)}
          data-testid="feedback-type"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          className="w-full rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[12px]"
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          data-testid="feedback-title"
        />
        <textarea
          className="h-24 w-full rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[12px]"
          placeholder="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          data-testid="feedback-description"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-900"
          data-testid="feedback-submit"
        >
          Enviar feedback
        </button>
        {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
      </form>

      <section className="space-y-2">
        <h2 className="text-[13px] font-medium text-zinc-300">Seus feedbacks</h2>
        {items.map((item) => (
          <div
            key={item.id}
            className="border border-white/[0.06] px-3 py-2 text-[12px]"
            data-testid={`feedback-item-${item.id}`}
          >
            <div className="flex justify-between gap-2">
              <span className="font-medium text-zinc-200">{item.title}</span>
              <span className="text-zinc-500">{item.status}</span>
            </div>
            <p className="text-zinc-400">{item.type}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
