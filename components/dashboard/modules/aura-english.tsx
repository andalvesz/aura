"use client";

import {
  BookOpen,
  CheckCircle2,
  Languages,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { LanguageModo } from "@/types/database";
import { parseJsonResponse } from "@/utils/safe-json";
import {
  CHAT_INPUT_CLASS,
  CHAT_SEND_CLASS,
} from "@/utils/dashboard-mobile";
import type { ParsedEnglishLesson } from "@/utils/english";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type AuraEnglishProps = {
  modo: LanguageModo;
  onLessonGenerated?: (lesson: ParsedEnglishLesson, lessonId: string | null) => void;
};

const QUICK_ACTIONS = [
  {
    id: "aula-diaria",
    label: "Aula diária",
    icon: BookOpen,
    prompt: "Me dê uma aula de inglês",
    mode: "aula_diaria" as const,
  },
  {
    id: "vocabulario",
    label: "Vocabulário",
    icon: Languages,
    prompt: "Gere vocabulário essencial",
    mode: "vocabulario" as const,
  },
  {
    id: "frases-uteis",
    label: "Frases úteis",
    icon: Sparkles,
    prompt: "Frases úteis para hoje",
    mode: "frases" as const,
  },
  {
    id: "exercicios",
    label: "Exercícios",
    icon: CheckCircle2,
    prompt: "Crie exercícios práticos",
    mode: "exercicio" as const,
  },
  {
    id: "simular-conversa",
    label: "Simular conversa",
    icon: MessageCircle,
    prompt: "Simular conversa",
    mode: "conversacao" as const,
  },
];

export function AuraEnglish({ modo, onLessonGenerated }: AuraEnglishProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Olá, Anderson. Sou a Aura English Coach. Escolha um modo ou peça sua aula diária — ex: \"Treinar inglês para aeroporto\" ou \"Simular conversa na Disney\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function sendMessage(
    text: string,
    options?: { actionId?: string; mode?: string }
  ) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const response = await fetch("/api/english-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          modo,
          history,
          ...(options?.actionId ? { actionId: options.actionId } : {}),
          ...(options?.mode ? { mode: options.mode } : {}),
        }),
      });

      const { data, error } = await parseJsonResponse<{
        text?: string;
        suggestion?: ParsedEnglishLesson;
        kind?: string;
        lessonId?: string | null;
        error?: string;
      }>(response);

      if (error || data?.error) {
        const errText = data?.error ?? error ?? "Erro ao consultar a IA.";
        setMessages((m) => [...m, { role: "assistant", text: errText }]);
        toast.error(errText);
        return;
      }

      if (data?.suggestion && data.kind !== "correcao") {
        const lesson = data.suggestion;
        const summary = [
          `**${lesson.titulo}**`,
          lesson.introducao,
          lesson.vocabulario.length
            ? `\nVocabulário: ${lesson.vocabulario.map((v) => v.termo).join(", ")}`
            : "",
          lesson.exercicios.length
            ? `\n${lesson.exercicios.length} exercício(s) gerado(s).`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        setMessages((m) => [...m, { role: "assistant", text: summary }]);
        onLessonGenerated?.(lesson, data.lessonId ?? null);
        toast.success("Aula gerada.");
        return;
      }

      const reply = data?.text ?? "Pronto para continuar.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Erro de conexão. Tente novamente." },
      ]);
      toast.error("Erro de conexão.");
    } finally {
      setLoading(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Languages className="size-3.5 text-violet-400" />
          Aura English Coach
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={loading}
                onClick={() =>
                  void sendMessage(action.prompt, {
                    actionId: action.id,
                    mode: action.mode,
                  })
                }
                className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200 disabled:opacity-50"
              >
                <Icon className="size-3" />
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-[12px] leading-relaxed ${
                msg.role === "user" ? "text-sky-300" : "text-zinc-400"
              }`}
            >
              <span className="font-medium text-zinc-500">
                {msg.role === "user" ? "Você: " : "Coach: "}
              </span>
              <span className="whitespace-pre-wrap">{msg.text}</span>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              Gerando resposta...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Treinar inglês para aeroporto"
            className={CHAT_INPUT_CLASS}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className={CHAT_SEND_CLASS}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </form>
      </PanelContent>
    </Panel>
  );
}
