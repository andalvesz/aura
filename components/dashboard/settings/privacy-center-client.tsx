"use client";

import { useState } from "react";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import type { PrivacyPrefs } from "@/lib/capabilities";
import {
  exportAccountAction,
  requestDeletionAction,
  updatePrivacyAction,
} from "@/app/actions/platform";

type Props = {
  initial: PrivacyPrefs;
};

export function PrivacyCenterClient({ initial }: Props) {
  const [prefs, setPrefs] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [exportJson, setExportJson] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");

  async function toggle(key: keyof PrivacyPrefs) {
    const patch = { [key]: !prefs[key] } as Partial<PrivacyPrefs>;
    const res = await updatePrivacyAction(patch);
    if (res.ok && res.data) setPrefs(res.data as PrivacyPrefs);
    setMsg(res.ok ? "Preferência atualizada" : res.error ?? "Erro");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4" data-testid="privacy-center">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Configurações", href: "/dashboard/settings" },
          { label: "Privacidade" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Privacy Center</h1>
        <p className="text-[12px] text-zinc-500">
          Controles de dados, learning, providers e exclusão — sem inventar conformidade legal.
        </p>
      </div>
      {msg ? <p className="text-[12px] text-zinc-400">{msg}</p> : null}

      <section className="space-y-2">
        <h2 className="text-[12px] font-medium text-zinc-400">Controles</h2>
        {(
          [
            ["learningEnabled", "Learning"],
            ["memoryPromotionEnabled", "Memory promotion"],
            ["externalProvidersEnabled", "Providers externos"],
            ["usageAnalyticsEnabled", "Usage analytics (legado)"],
            ["analyticsProduct", "Analytics de produto"],
            ["analyticsPerformance", "Analytics de performance"],
            ["analyticsProviders", "Analytics de providers"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2 text-[13px] text-zinc-200"
            data-testid={`privacy-${key}`}
          >
            <span>{label}</span>
            <span className="text-[11px] text-zinc-500">
              {prefs[key] ? "Ativo" : "Desativado"}
            </span>
          </button>
        ))}
        <p className="text-[11px] text-zinc-600" data-testid="privacy-essential-note">
          Analytics essenciais de segurança permanecem sempre ativos e não podem ser desligados.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-medium text-zinc-400">Exportação</h2>
        <button
          type="button"
          className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
          onClick={async () => {
            const res = await exportAccountAction();
            if (res.ok) setExportJson(JSON.stringify(res.data, null, 2));
            setMsg(res.ok ? "Export gerado" : res.error ?? "Erro");
          }}
        >
          Exportar minha conta (versionado)
        </button>
        {exportJson ? (
          <pre className="max-h-48 overflow-auto rounded border border-white/[0.06] p-2 text-[10px] text-zinc-500">
            {exportJson}
          </pre>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-medium text-rose-300/80">Exclusão de conta</h2>
        <p className="text-[11px] text-zinc-500">
          Não é imediata. Digite EXCLUIR MINHA CONTA para solicitar revisão (7 dias).
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo"
          className="h-20 w-full rounded border border-white/10 bg-black/40 p-2 text-[12px] text-zinc-300"
        />
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="EXCLUIR MINHA CONTA"
          className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-zinc-300"
        />
        <button
          type="button"
          className="rounded-md border border-rose-500/40 px-3 py-1.5 text-[12px] text-rose-300"
          onClick={async () => {
            const res = await requestDeletionAction({
              reason,
              confirmPhrase: confirm,
            });
            setMsg(
              res.ok
                ? "Solicitação em REVIEW — sem wipe automático"
                : res.error ?? "Erro"
            );
          }}
        >
          Solicitar exclusão
        </button>
      </section>

      <section className="text-[11px] text-zinc-600">
        <p>Também veja Identity, Memory e workspaces nas configurações.</p>
      </section>
    </div>
  );
}
