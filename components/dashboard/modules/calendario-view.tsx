"use client";

import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { MiniCalendar } from "../mini-calendar";

export function CalendarioView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: "Olá, Anderson. Sua agenda está vazia. Diga o que deseja organizar.",
    },
  ]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();

    const text = input.trim();

    if (!text) return;

    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "assistant",
        text: "Ainda não estou conectada ao calendário real, mas esse comando foi registrado para futura integração.",
      },
    ]);

    setInput("");
  }

  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1fr_minmax(0,280px)]">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="lg:col-span-1">
          <MiniCalendar />
        </div>

        <Panel>
          <PanelHeader>
            <PanelTitle>Próximos eventos</PanelTitle>
          </PanelHeader>

          <PanelContent className="pt-0">
            <div className="flex min-h-[180px] items-center justify-center rounded-md border border-dashed border-white/[0.06]">
              <div className="text-center">
                <p className="text-[13px] font-medium text-zinc-400">
                  Nenhum evento cadastrado
                </p>

                <p className="mt-1 text-[11px] text-zinc-600">
                  Seus compromissos aparecerão aqui.
                </p>
              </div>
            </div>
          </PanelContent>
        </Panel>
      </div>

      <Panel className="flex min-h-[320px] flex-col xl:min-h-[420px]">
        <PanelHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-violet-500/15">
              <Sparkles className="size-3.5 text-violet-400" />
            </div>

            <PanelTitle>Aura IA</PanelTitle>
          </div>

          <Bot className="size-4 text-zinc-600" />
        </PanelHeader>

        <PanelContent className="flex flex-1 flex-col pt-0">
          <div className="mb-2 flex-1 space-y-2 overflow-y-auto max-h-[280px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`rounded-md px-2.5 py-2 text-[12px] ${
                  msg.role === "user"
                    ? "ml-4 bg-white/[0.06] text-zinc-200"
                    : "mr-4 bg-violet-500/10 text-violet-100/90"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="mt-auto flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Diga o que deseja marcar..."
              className="h-9 flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-white/[0.12] focus:outline-none"
            />

            <button
              type="submit"
              className="flex size-9 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.06]"
              aria-label="Enviar"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </PanelContent>
      </Panel>
    </div>
  );
}