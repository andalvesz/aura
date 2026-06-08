"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Mail, MessageCircle, Send, UserX } from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type { CommsDashboardStats } from "@/utils/comms";
import { parseJsonResponse } from "@/utils/safe-json";

export function CommsDashboardCard() {
  const [stats, setStats] = useState<CommsDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/comms/stats");
        const { data } = await parseJsonResponse<CommsDashboardStats & { error?: string }>(
          res
        );
        if (!cancelled && data && !data.error) {
          setStats(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel className="border-indigo-500/10 bg-indigo-500/[0.03]">
      <PanelHeader className="flex flex-row items-center justify-between">
        <PanelTitle className="flex items-center gap-2">
          <Mail className="size-3.5 text-indigo-400" />
          Comunicações
        </PanelTitle>
        <Link
          href="/dashboard/comunicacao"
          className="text-[11px] text-indigo-300/80 hover:text-indigo-200"
        >
          Abrir centro →
        </Link>
      </PanelHeader>
      <PanelContent className="pt-0">
        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" />
            Carregando...
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <UserX className="size-3" />
                Sem resposta
              </div>
              <p className="mt-1 text-lg font-semibold text-rose-300">{stats.semResposta}</p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Send className="size-3" />
                Aguardando retorno
              </div>
              <p className="mt-1 text-lg font-semibold text-amber-300">
                {stats.aguardandoRetorno}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <MessageCircle className="size-3" />
                Follow-up pendente
              </div>
              <p className="mt-1 text-lg font-semibold text-violet-300">
                {stats.followUpPendente}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Mail className="size-3" />
                E-mails enviados
              </div>
              <p className="mt-1 text-lg font-semibold text-zinc-100">{stats.emailsSent}</p>
            </div>
            <div className="col-span-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-2 sm:col-span-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Send className="size-3" />
                Propostas
              </div>
              <p className="mt-1 text-lg font-semibold text-zinc-100">
                {stats.propostasSent}{" "}
                <span className="text-sm font-normal text-zinc-500">
                  · {stats.propostasOpened} aberta(s)
                </span>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-zinc-500">Sem dados de comunicação.</p>
        )}
        {stats && !stats.gmailConnected && stats.gmailConfigured && (
          <p className="mt-2 text-[11px] text-zinc-600">
            Conecte o Gmail em Comunicação para sincronizar a caixa de entrada.
          </p>
        )}
      </PanelContent>
    </Panel>
  );
}
