"use client";

import { useState, useTransition } from "react";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { getDiagnosticsAction } from "@/app/actions/beta-ops";

type Props = {
  initialCopyText: string;
  version: string | null;
};

export function DiagnosticsClient({ initialCopyText, version }: Props) {
  const [text, setText] = useState(initialCopyText);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="user-diagnostics">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Configurações", href: "/dashboard/settings" },
          { label: "Diagnóstico" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Diagnóstico</h1>
        <p className="text-[12px] text-zinc-500">
          Snapshot sanitizado para suporte. Versão: {version ?? "—"}. Sem secrets.
        </p>
      </div>
      <pre
        className="max-h-96 overflow-auto border border-white/[0.06] bg-zinc-950 p-3 text-[11px] text-zinc-400"
        data-testid="diagnostics-text"
      >
        {text}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-white/[0.1] px-3 py-1.5 text-[12px] text-zinc-200"
          data-testid="diagnostics-copy"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setMsg("Copiado");
          }}
        >
          Copiar diagnóstico
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border border-white/[0.1] px-3 py-1.5 text-[12px] text-zinc-200"
          onClick={() =>
            start(async () => {
              const res = await getDiagnosticsAction();
              if (res.ok && res.data) {
                const d = res.data as { copyText: string };
                setText(d.copyText);
                setMsg("Atualizado");
              } else setMsg(res.error ?? "erro");
            })
          }
        >
          Atualizar
        </button>
      </div>
      {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
    </div>
  );
}
