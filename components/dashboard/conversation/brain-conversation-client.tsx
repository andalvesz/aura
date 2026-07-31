"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  cancelConversationActionAction,
  confirmConversationActionAction,
  explainConversationResponseAction,
  listConversationsAction,
  sendConversationMessageAction,
  startConversationAction,
  updateConversationContextAction,
} from "@/app/actions/conversation";
import {
  QUICK_STARTS,
  type ConversationMessage,
  type ConversationPendingAction,
  type ConversationRecord,
  type HandleConversationResult,
} from "@/lib/conversation";

type Props = {
  initialConversations: ConversationRecord[];
};

export function BrainConversationClient({ initialConversations }: Props) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [pending, setPending] = useState<ConversationPendingAction | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [contextLabel, setContextLabel] = useState(
    initialConversations[0]?.focus.label ?? "Pessoal"
  );
  const [explain, setExplain] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const abortRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  function refreshList() {
    start(async () => {
      const { items } = await listConversationsAction();
      setConversations(items);
    });
  }

  async function ensureConversation(): Promise<string> {
    if (activeId) return activeId;
    const { conversation } = await startConversationAction({
      title: "Nova conversa",
    });
    setActiveId(conversation.id);
    setContextLabel(conversation.focus.label);
    refreshList();
    return conversation.id;
  }

  function simulateStream(full: string) {
    abortRef.current = false;
    setStreaming(true);
    setStreamText("");
    const chunks = full.match(/.{1,24}/g) ?? [full];
    let i = 0;
    const tick = () => {
      if (abortRef.current) {
        setStreaming(false);
        return;
      }
      if (i >= chunks.length) {
        setStreaming(false);
        setStreamText("");
        return;
      }
      setStreamText((prev) => prev + chunks[i]);
      i += 1;
      window.setTimeout(tick, 12);
    };
    tick();
  }

  function applyResult(result: HandleConversationResult) {
    if (!result.ok) {
      setError(result.blockedReason ?? result.error ?? "Erro");
      return;
    }
    setError(null);
    if (result.conversation) {
      setActiveId(result.conversation.id);
      setContextLabel(result.conversation.focus.label);
    }
    if (result.assistantMessage) {
      setMessages((prev) => {
        const withoutDup = prev.filter(
          (m) => m.id !== result.assistantMessage!.id
        );
        // user message already optimistic? keep both
        return [...withoutDup, result.assistantMessage!];
      });
      simulateStream(result.assistantMessage.content);
    }
    setPending(
      result.pendingAction?.status === "PENDING" ? result.pendingAction : null
    );
    if (result.navigationHref) {
      // Safe navigation — user can click; we also offer button
    }
    refreshList();
  }

  function send(text: string) {
    const message = text.trim();
    if (!message) return;
    setInput("");
    setExplain(null);
    const optimistic: ConversationMessage = {
      id: `tmp_${Date.now()}`,
      conversationId: activeId ?? "tmp",
      role: "user",
      content: message,
      intentKind: null,
      citations: [],
      draftIds: [],
      pendingActionIds: [],
      navigationHref: null,
      explanation: null,
      createdAt: new Date().toISOString(),
      softDeleted: false,
    };
    setMessages((prev) => [...prev, optimistic]);

    start(async () => {
      const id = await ensureConversation();
      const result = await sendConversationMessageAction({
        conversationId: id,
        message,
      });
      if (result.ok && result.assistantMessage) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimistic.id),
          {
            ...optimistic,
            id: `user_${result.assistantMessage!.id}`,
            conversationId: id,
          },
          result.assistantMessage!,
        ]);
        simulateStream(result.assistantMessage.content);
        setPending(
          result.pendingAction?.status === "PENDING"
            ? result.pendingAction
            : null
        );
        if (result.conversation) setContextLabel(result.conversation.focus.label);
        setError(null);
      } else {
        setError(result.blockedReason ?? result.error ?? "Falha");
      }
      refreshList();
    });
  }

  function cancelStream() {
    abortRef.current = true;
    setStreaming(false);
  }

  return (
    <div
      className="mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col gap-3 p-3 md:flex-row md:p-4"
      data-testid="brain-conversation"
    >
      <aside className="w-full shrink-0 space-y-2 md:w-56">
        <button
          type="button"
          className="w-full rounded border border-cyan-500/30 px-2 py-2 text-[12px] text-cyan-100"
          onClick={() =>
            start(async () => {
              const { conversation } = await startConversationAction();
              setActiveId(conversation.id);
              setMessages([]);
              setPending(null);
              setContextLabel(conversation.focus.label);
              refreshList();
            })
          }
        >
          Nova conversa
        </button>
        <ul className="max-h-48 space-y-1 overflow-y-auto md:max-h-[60vh]">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveId(c.id);
                  setContextLabel(c.focus.label);
                  setMessages([]);
                  setPending(null);
                }}
                className={`w-full truncate rounded px-2 py-1.5 text-left text-[12px] ${
                  activeId === c.id
                    ? "bg-white/10 text-zinc-100"
                    : "text-zinc-400 hover:bg-white/5"
                }`}
              >
                {c.title}
              </button>
            </li>
          ))}
        </ul>
        <Link
          href="/dashboard"
          className="block text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          ← Aura Home
        </Link>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <header className="border-b border-white/[0.06] p-3">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">
            Você está conversando no contexto de
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-medium text-zinc-100" data-testid="brain-context-label">
              {contextLabel}
            </p>
            <select
              className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-zinc-200"
              defaultValue="personal"
              onChange={(e) => {
                const mode = e.target.value;
                if (!activeId) return;
                start(async () => {
                  const focus =
                    mode === "workspace"
                      ? { contextMode: "workspace" as const, label: "Workspace" }
                      : mode === "project"
                        ? {
                            contextMode: "personal" as const,
                            projectId: "focus-project",
                            label: "Projeto",
                          }
                        : {
                            contextMode: "personal" as const,
                            projectId: null,
                            planId: null,
                            missionId: null,
                            label: "Pessoal",
                          };
                  const res = await updateConversationContextAction({
                    conversationId: activeId,
                    focus,
                  });
                  if (res.conversation) setContextLabel(res.conversation.focus.label);
                });
              }}
              aria-label="Trocar contexto"
            >
              <option value="personal">Pessoal</option>
              <option value="workspace">Workspace</option>
              <option value="project">Projeto</option>
            </select>
          </div>
        </header>

        {!messages.length && !streaming ? (
          <div className="grid gap-2 p-3 sm:grid-cols-2" data-testid="brain-quick-starts">
            {QUICK_STARTS.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => send(q.prompt)}
                className="rounded border border-white/10 px-3 py-2 text-left text-[12px] text-zinc-300 hover:border-cyan-500/30 hover:text-cyan-100"
              >
                {q.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-md px-3 py-2 text-[13px] ${
                m.role === "user"
                  ? "ml-6 bg-cyan-500/10 text-cyan-50"
                  : "mr-6 bg-white/[0.04] text-zinc-200"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.citations.length ? (
                <ul className="mt-2 space-y-1 border-t border-white/5 pt-2">
                  {m.citations.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={c.href}
                        className="text-[11px] text-amber-200/90 hover:underline"
                      >
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.role === "assistant" && m.explanation ? (
                <button
                  type="button"
                  className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300"
                  onClick={() =>
                    start(async () => {
                      const res = await explainConversationResponseAction(m.id);
                      setExplain(
                        res.explanation
                          ? [
                              res.explanation.why,
                              `Confiança: ${Math.round(res.explanation.confidence * 100)}%`,
                              res.explanation.executedAnything
                                ? res.explanation.executedSummary
                                : "Nada executado.",
                            ].join("\n")
                          : "Sem explicação."
                      );
                    })
                  }
                >
                  Por que você está dizendo isso?
                </button>
              ) : null}
              {m.navigationHref ? (
                <button
                  type="button"
                  className="mt-2 block text-[11px] text-cyan-300"
                  onClick={() => router.push(m.navigationHref!)}
                >
                  Abrir {m.navigationHref} →
                </button>
              ) : null}
            </div>
          ))}
          {streaming && streamText ? (
            <div className="mr-6 rounded-md bg-white/[0.04] px-3 py-2 text-[13px] text-zinc-400">
              {streamText}
              <span className="animate-pulse">▍</span>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {explain ? (
          <div className="border-t border-white/[0.06] bg-black/20 p-3 text-[12px] text-zinc-400 whitespace-pre-wrap">
            {explain}
          </div>
        ) : null}

        {pending ? (
          <div
            className="border-t border-amber-500/20 bg-amber-500/5 p-3"
            data-testid="brain-confirmation-card"
          >
            <p className="text-[12px] font-medium text-amber-100">{pending.title}</p>
            <p className="mt-1 text-[11px] text-zinc-400">{pending.changesSummary}</p>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-zinc-500">
              <div>Origem: {pending.origin}</div>
              <div>Risco: {pending.riskLevel}</div>
              <div>Reversível: {pending.reversibility}</div>
              <div>Expira: {pending.expiresAt.slice(0, 16)}</div>
            </dl>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded border border-emerald-500/40 px-3 py-1.5 text-[12px] text-emerald-100"
                onClick={() =>
                  start(async () => {
                    if (!activeId) return;
                    const result = await confirmConversationActionAction({
                      conversationId: activeId,
                      actionId: pending.id,
                    });
                    applyResult(result);
                    setPending(null);
                  })
                }
              >
                Confirmar
              </button>
              <button
                type="button"
                className="rounded border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
                onClick={() =>
                  start(async () => {
                    if (!activeId) return;
                    await cancelConversationActionAction({
                      conversationId: activeId,
                      actionId: pending.id,
                    });
                    setPending(null);
                  })
                }
              >
                Cancelar
              </button>
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">
              Confirmação server-side com ID + payload hash. “Sim” no chat não executa.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="px-3 text-[12px] text-red-400" data-testid="brain-error">
            {error}
          </p>
        ) : null}

        <footer className="border-t border-white/[0.06] p-3">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              placeholder="Pergunte ao Aura… (ex.: O que merece minha atenção hoje?)"
              className="min-h-11 flex-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600"
              data-testid="brain-message-input"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={isPending || !input.trim()}
                onClick={() => send(input)}
                className="min-h-11 rounded border border-cyan-500/40 px-3 text-[12px] text-cyan-100 disabled:opacity-40"
              >
                Enviar
              </button>
              {streaming ? (
                <button
                  type="button"
                  onClick={cancelStream}
                  className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-400"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">
            Anexos: use Smart Capture / Knowledge Hub. O chat resume e relaciona; não promove
            automaticamente para Memory.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <Link href="/dashboard/inbox" className="text-cyan-400/90 hover:underline">
              Anexar via Inbox
            </Link>
            <Link href="/dashboard/knowledge" className="text-amber-400/90 hover:underline">
              Knowledge
            </Link>
            <Link href="/dashboard/agents" className="text-indigo-400/90 hover:underline">
              Agentes
            </Link>
          </div>
        </footer>
      </section>
    </div>
  );
}
