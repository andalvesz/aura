"use client";

import { useState } from "react";
import { parseJsonResponse } from "@/utils/safe-json";
import { Send, Sparkles } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export function AuraChat() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Olá, Anderson. Sou a Aura IA. Como posso te ajudar hoje?",
    },
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const text = input.trim();

    if (!text || loading) return;

    setInput("");
    setLoading(true);

    setMessages((current) => [...current, { role: "user", text }]);

    try {
      const response = await fetch("/api/aura", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      const { data, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
      }>(response);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            parseError ??
            data?.text ??
            data?.error ??
            "Não consegui responder agora.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Erro ao conectar com a Aura IA.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-violet-500/15">
          <Sparkles className="size-4 text-violet-400" />
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-100">Aura IA</p>
          <p className="text-xs text-zinc-600">
            Assistente pessoal do seu sistema operacional
          </p>
        </div>
      </div>

      <div className="mb-3 max-h-[320px] space-y-2 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`rounded-lg px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-8 bg-white/[0.06] text-zinc-200"
                : "mr-8 bg-violet-500/10 text-violet-100"
            }`}
          >
            {message.text}
          </div>
        ))}

        {loading && (
          <div className="mr-8 rounded-lg bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
            Pensando...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo para a Aura..."
          className="h-10 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="flex size-10 items-center justify-center rounded-md bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  );
}