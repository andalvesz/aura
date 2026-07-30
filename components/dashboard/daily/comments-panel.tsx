"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addCommentAction,
  editCommentAction,
  listCommentsAction,
} from "@/app/actions/daily";
import type { CommentTargetType, DailyComment } from "@/lib/daily/types";
import { EmptyState } from "@/components/dashboard/empty-state";

export function CommentsPanel({
  targetType,
  targetId,
  shareWithWorkspace,
}: {
  targetType: CommentTargetType;
  targetId: string;
  shareWithWorkspace?: boolean;
}) {
  const [comments, setComments] = useState<DailyComment[]>([]);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pending, start] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listCommentsAction(targetType, targetId).then((rows) => {
      if (!cancelled) {
        setComments(rows);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  return (
    <section className="space-y-2" data-testid="comments-panel">
      <h3 className="text-[12px] font-medium text-zinc-300">Comentários</h3>
      {loaded && !comments.length ? (
        <EmptyState
          title="Nenhum comentário"
          description="Seja o primeiro a comentar — ajuda o time a contextualizar."
        />
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded border border-white/[0.06] bg-zinc-950/40 p-2 text-[12px]"
            >
              {editingId === c.id ? (
                <form
                  className="space-y-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(async () => {
                      const res = await editCommentAction({
                        commentId: c.id,
                        body: editBody,
                      });
                      if (res.error) toast.error(res.error);
                      else {
                        toast.success("Comentário atualizado");
                        setEditingId(null);
                        const rows = await listCommentsAction(
                          targetType,
                          targetId
                        );
                        setComments(rows);
                      }
                    });
                  }}
                >
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-[12px]"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="text-[10px] text-cyan-300"
                  >
                    Salvar
                  </button>
                </form>
              ) : (
                <>
                  <p className="text-zinc-200">{c.body}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    {c.userId.slice(0, 8)}… ·{" "}
                    {new Date(c.createdAt).toLocaleString("pt-BR")}
                    {c.editedAt ? " · editado" : ""}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-[10px] text-zinc-500 hover:text-zinc-300"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditBody(c.body);
                    }}
                  >
                    Editar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addCommentAction({
              targetType,
              targetId,
              body,
              shareWithWorkspace,
            });
            if (res.error) toast.error(res.error);
            else {
              toast.success("Comentário adicionado");
              setBody("");
              const rows = await listCommentsAction(targetType, targetId);
              setComments(rows);
            }
          });
        }}
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escrever comentário…"
          className="min-w-0 flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-[12px] text-zinc-100"
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="rounded bg-zinc-100 px-3 py-1.5 text-[11px] font-medium text-zinc-900 disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </section>
  );
}
