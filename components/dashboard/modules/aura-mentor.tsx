"use client";

import {
  BarChart3,
  CalendarDays,
  Camera,
  Filter,
  LineChart,
  ListOrdered,
  PenLine,
  Send,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react";
import { useRef, useState } from "react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type QuickAction = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prompt: string;
  usesLeadData?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "plano-vendas",
    label: "Criar plano de vendas",
    icon: TrendingUp,
    prompt:
      "Crie um plano de vendas completo para os próximos 30 dias, considerando Alvesz Experience e Consórcios. Inclua metas, canais, ações diárias e indicadores.",
  },
  {
    id: "criar-oferta",
    label: "Criar oferta",
    icon: Tag,
    prompt:
      "Ajude-me a criar uma oferta irresistível para vender online. Considere meus negócios (Alvesz Experience e Consórcios) e sugira estrutura de oferta, preço, bônus e CTA.",
  },
  {
    id: "analisar-leads",
    label: "Analisar leads",
    icon: BarChart3,
    usesLeadData: true,
    prompt:
      "Com base nos meus leads reais do CRM, analise o pipeline atual: qualificação, conversão e próximos passos. Cite os leads pelo nome, status e valor.",
  },
  {
    id: "priorizar-oportunidades",
    label: "Priorizar oportunidades",
    icon: ListOrdered,
    usesLeadData: true,
    prompt:
      "Com base nos meus leads reais, priorize as oportunidades ordenando por valor e status. Destaque oportunidades quentes (Negociação = ALTA, Proposta = MÉDIA). Para cada lead, informe valor, status, prioridade e uma ação sugerida.",
  },
  {
    id: "diagnostico-funil",
    label: "Diagnóstico do funil",
    icon: Filter,
    usesLeadData: true,
    prompt:
      "Com base nos meus leads reais, faça um diagnóstico completo do funil: distribuição por etapa (Novo, Contato, Proposta, Negociação, Fechado, Perdido), percentuais, gargalos e recomendações práticas para destravar conversões.",
  },
  {
    id: "previsao-receita",
    label: "Previsão de receita",
    icon: LineChart,
    usesLeadData: true,
    prompt:
      "Com base nos meus leads reais, apresente a previsão de receita: receita potencial, receita provável (ponderada por probabilidade de fechamento) e receita fechada. Explique a estimativa e sugira ações para converter oportunidades.",
  },
  {
    id: "gerar-conteudo",
    label: "Gerar Conteúdo",
    icon: PenLine,
    usesLeadData: true,
    prompt:
      "Com base nos meus leads reais do CRM, analise os nichos mais frequentes e gere um plano de conteúdo: 5 ideias de reels, 5 de stories, 5 de posts e CTAs para captação. Priorize a maior demanda identificada.",
  },
  {
    id: "estrategia-instagram",
    label: "Estratégia Instagram",
    icon: Camera,
    prompt:
      "Crie uma estratégia de Instagram para crescer seguidores e gerar leads em Indaiatuba. Inclua tipos de conteúdo, frequência, hashtags e ideias de reels.",
  },
  {
    id: "planejamento-semanal",
    label: "Planejamento semanal",
    icon: CalendarDays,
    usesLeadData: true,
    prompt:
      "Com base nos meus leads reais do CRM, monte meu planejamento semanal de conteúdo (Segunda a Domingo) com reels, stories e posts sugeridos por dia. Priorize a maior demanda do funil e inclua CTAs de captação.",
  },
];

export function AuraMentor() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Olá, Anderson. Sou o Aura Mentor — seu assistente comercial estratégico. Use os atalhos abaixo ou escreva sua pergunta para começarmos.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function sendMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));

    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    scrollToBottom();

    try {
      const response = await fetch("/api/aura-mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          ...(actionId ? { actionId } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: data.error ?? "Não consegui responder agora.",
          },
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.text ?? "Não consegui responder agora.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Erro ao conectar com o Aura Mentor. Tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleQuickAction(action: QuickAction) {
    sendMessage(action.prompt, action.usesLeadData ? action.id : undefined);
  }

  return (
    <Panel className="border-violet-500/10 bg-violet-500/[0.02]">
      <PanelHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-violet-500/15">
            <Sparkles className="size-3.5 text-violet-400" />
          </div>
          <div>
            <PanelTitle>Aura Mentor</PanelTitle>
            <p className="text-[10px] text-zinc-600">
              Assistente comercial · Alvesz · Consórcios · Indaiatuba
            </p>
          </div>
        </div>
      </PanelHeader>

      <PanelContent className="pt-0">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                disabled={loading}
                onClick={() => handleQuickAction(action)}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-violet-400/20 hover:bg-violet-500/[0.06] hover:text-violet-200 disabled:opacity-50"
              >
                <Icon className="size-3 shrink-0" />
                {action.label}
              </button>
            );
          })}
        </div>

        <div className="mb-3 max-h-[360px] space-y-2 overflow-y-auto rounded-lg border border-white/[0.06] bg-zinc-950/40 p-2">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                message.role === "user"
                  ? "ml-6 bg-white/[0.06] text-zinc-200"
                  : "mr-6 bg-violet-500/10 text-violet-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          ))}

          {loading && (
            <div className="mr-6 rounded-lg bg-violet-500/10 px-3 py-2 text-[13px] text-violet-300">
              Analisando estratégia...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre vendas, Instagram, leads ou estratégia..."
            disabled={loading}
            className="h-10 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/40 focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </form>
      </PanelContent>
    </Panel>
  );
}
