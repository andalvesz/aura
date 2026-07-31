"use client";

import { useState } from "react";
import {
  disableCapabilityPure,
  enableCapabilityPure,
  exportConfigurationPure,
  getPlatformState,
  importConfigurationPure,
  listCapabilities,
  previewImportPure,
  resolveCapabilities,
  setNavigationOrderPure,
  setPlatformState,
  type ResolveContext,
} from "@/lib/capabilities";

type Props = {
  userId: string;
  workspaceId: string | null;
  workspaceSlug?: string | null;
  role: ResolveContext["role"];
};

export function CapabilitiesSettingsClient(props: Props) {
  const ctx: ResolveContext = {
    userId: props.userId,
    workspaceId: props.workspaceId,
    workspaceSlug: props.workspaceSlug ?? null,
    role: props.role,
    isWorkspaceMember: Boolean(props.workspaceId),
  };
  const [, bump] = useState(0);
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [exportText, setExportText] = useState("");

  const resolved = resolveCapabilities(getPlatformState(), ctx);

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="capabilities-settings">
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Capabilities</h1>
        <p className="text-[12px] text-zinc-500">
          Ativar/desativar módulos, dependências, export/import seguro.
        </p>
      </div>
      {msg ? <p className="text-[12px] text-zinc-400">{msg}</p> : null}
      <ul className="space-y-2">
        {resolved.map((c) => (
          <li
            key={c.definition.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2"
          >
            <div>
              <p className="text-[13px] text-zinc-100">
                {c.definition.name}
                {c.definition.core ? (
                  <span className="ml-2 text-[10px] text-amber-400">CORE</span>
                ) : null}
              </p>
              <p className="text-[11px] text-zinc-500">
                {c.definition.description} · v{c.definition.version}
              </p>
              <p className="text-[10px] text-zinc-600">
                deps:{" "}
                {c.definition.dependencies.map((d) => d.capabilityId).join(", ") ||
                  "—"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={c.definition.core}
                className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-300 disabled:opacity-40"
                onClick={() => {
                  const res = enableCapabilityPure(
                    getPlatformState(),
                    c.definition.id,
                    ctx
                  );
                  setPlatformState(res.state);
                  setMsg(res.ok ? "Ativada" : res.issues.map((i) => i.message).join("; "));
                  bump((n) => n + 1);
                }}
              >
                On
              </button>
              <button
                type="button"
                disabled={c.definition.core}
                className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-300 disabled:opacity-40"
                onClick={() => {
                  const res = disableCapabilityPure(
                    getPlatformState(),
                    c.definition.id,
                    ctx
                  );
                  setPlatformState(res.state);
                  setMsg(res.ok ? "Desativada" : res.issues.map((i) => i.message).join("; "));
                  bump((n) => n + 1);
                }}
              >
                Off
              </button>
            </div>
          </li>
        ))}
      </ul>

      <section className="space-y-2">
        <h2 className="text-[12px] font-medium text-zinc-400">Navegação</h2>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
          onClick={() => {
            const order = listCapabilities().flatMap((c) =>
              c.navigationItems.map((n) => n.id)
            );
            setPlatformState(setNavigationOrderPure(getPlatformState(), props.userId, order));
            setMsg("Ordem de navegação restaurada ao padrão do catálogo");
            bump((n) => n + 1);
          }}
        >
          Restaurar navegação padrão
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-[12px] font-medium text-zinc-400">Export / Import</h2>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
          onClick={() => {
            const { bundle, state } = exportConfigurationPure(getPlatformState(), ctx);
            setPlatformState(state);
            setExportText(JSON.stringify(bundle, null, 2));
            setMsg("Export gerado (sem secrets)");
          }}
        >
          Exportar configuração
        </button>
        {exportText ? (
          <pre className="max-h-40 overflow-auto rounded border border-white/[0.06] p-2 text-[10px] text-zinc-500">
            {exportText}
          </pre>
        ) : null}
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Cole JSON versionado"
          className="h-28 w-full rounded border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-zinc-300"
        />
        <button
          type="button"
          className="rounded border border-cyan-500/30 px-3 py-1.5 text-[12px] text-cyan-300"
          onClick={() => {
            try {
              const parsed = JSON.parse(importText) as unknown;
              const preview = previewImportPure(parsed);
              if (!preview.ok) {
                setMsg(preview.issues.map((i) => i.message).join("; "));
                return;
              }
              const res = importConfigurationPure(getPlatformState(), ctx, parsed, {
                confirmed: true,
              });
              setPlatformState(res.state);
              setMsg(res.ok ? "Import confirmado" : res.issues.map((i) => i.message).join("; "));
              bump((n) => n + 1);
            } catch {
              setMsg("JSON inválido");
            }
          }}
        >
          Validar e importar
        </button>
      </section>
    </div>
  );
}
