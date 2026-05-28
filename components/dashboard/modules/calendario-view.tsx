"use client";

import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { MiniCalendar } from "../mini-calendar";

const events = [
  { title: "Reunião com cliente", time: "Amanhã · 15:00", tag: "Trabalho" },
  { title: "Treino — pernas", time: "Qua · 07:00", tag: "Saúde" },
  { title: "Gravação Reels", time: "Qui · 18:30", tag: "Social" },
  { title: "Follow-up consórcio", time: "Sex · 10:00", tag: "Vendas" },
];

const examplePrompt = "Reunião com cliente amanhã às 15h";

export function CalendarioView() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([
    {
      role: "assistant",
      text: "Olá, Anderson. Diga o que deseja marcar e eu organizo na sua agenda.",
    },
  ]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim() || examplePrompt;
    if (!text) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "assistant",
        text: `Agendado: "${text}". Confirme no calendário ao lado.`,
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
          <PanelContent className="space-y-1 pt-0">
            {events.map((ev) => (
              <div
                key={ev.title}
                className="rounded-md border border-white/[0.04] px-2.5 py-2 transition-colors duration-200 hover:bg-white/[0.03]"
              >
                <p className="text-[13px] text-zinc-200">{ev.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-600">
                  <span>{ev.time}</span>
                  <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
                    {ev.tag}
                  </span>
                </div>
              </div>
            ))}
            <p className="mt-2 rounded-md bg-violet-500/10 px-2 py-1.5 text-[11px] text-violet-200/90">
              Exemplo: &ldquo;{examplePrompt}&rdquo;
            </p>
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
