"use client";

import Link from "next/link";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import type { AdminPlatformSnapshot } from "@/lib/capabilities/admin";
import type { PlatformHealthReport } from "@/lib/capabilities";

type PlatformAdminClientProps = {
  userId: string;
  allowlistConfigured: boolean;
  ok: boolean;
  snapshot: AdminPlatformSnapshot | null;
  beta?: { total: number; byStatus: Record<string, number> };
  platformHealth?: PlatformHealthReport | null;
};

export function PlatformAdminClient({
  userId,
  allowlistConfigured,
  ok,
  snapshot,
  beta,
  platformHealth,
}: PlatformAdminClientProps) {
  const note =
    "Acesso via AURA_PLATFORM_ADMIN_USER_IDS (allowlist no servidor). Sem impersonação. " +
    (allowlistConfigured ? "Allowlist configurada." : "Allowlist vazia.");

  if (!ok || !snapshot) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4" data-testid="platform-admin-denied">
        <PageBreadcrumb
          items={[
            { label: "Meu Dia", href: "/dashboard" },
            { label: "Admin" },
          ]}
        />
        <h1 className="text-lg font-medium text-zinc-100">Sem permissão</h1>
        <p className="text-[12px] text-zinc-500">
          Seu usuário não está na allowlist de administradores da plataforma.
        </p>
        <p className="text-[11px] text-zinc-600">{note}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4" data-testid="platform-admin">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Platform Admin" },
        ]}
      />
      <header className="space-y-1">
        <h1 className="text-lg font-medium text-zinc-100">Platform Admin</h1>
        <p className="text-[12px] text-zinc-500">{note}</p>
        <p className="text-[10px] text-zinc-600">admin: {userId.slice(0, 8)}…</p>
      </header>

      {platformHealth ? (
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[13px] text-zinc-200">
            Platform Health · {platformHealth.overall}
          </h2>
          <ul className="mt-2 space-y-1 text-[11px] text-zinc-500">
            {platformHealth.components.map((c) => (
              <li key={c.id}>
                {c.label}: {c.status} — {c.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {beta ? (
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[13px] text-zinc-200">Beta access (agregado)</h2>
          <p className="text-[11px] text-zinc-500">Total: {beta.total}</p>
          <pre className="mt-1 text-[11px] text-zinc-500">
            {JSON.stringify(beta.byStatus, null, 2)}
          </pre>
          <p className="mt-2 text-[10px] text-zinc-600">
            Suspender/reativar via API server-side — sem dados privados de usuários.
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[13px] text-zinc-200">Versions</h2>
        <pre className="mt-2 text-[11px] text-zinc-500">
          {JSON.stringify(snapshot.versions, null, 2)}
        </pre>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[13px] text-zinc-200">
          Capabilities ({snapshot.capabilities.length})
        </h2>
        <ul className="mt-2 max-h-40 overflow-auto text-[11px] text-zinc-500">
          {snapshot.capabilities.map((c) => (
            <li key={c.id}>
              {c.id} v{c.version} · {c.status}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[13px] text-zinc-200">Skills ({snapshot.skills.length})</h2>
        <ul className="mt-2 max-h-40 overflow-auto text-[11px] text-zinc-500">
          {snapshot.skills.map((s) => (
            <li key={s.id}>
              {s.id} · {s.visibility}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[13px] text-zinc-200">Feature flags</h2>
        <pre className="mt-2 max-h-32 overflow-auto text-[10px] text-zinc-500">
          {JSON.stringify(snapshot.featureFlags, null, 2)}
        </pre>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[13px] text-zinc-200">Usage agregado</h2>
        <pre className="mt-2 text-[11px] text-zinc-500">
          {JSON.stringify(snapshot.usage, null, 2)}
        </pre>
      </section>

      <section className="rounded-lg border border-white/[0.06] p-3">
        <h2 className="text-[13px] text-zinc-200">Migrations (capability decls)</h2>
        <p className="text-[11px] text-zinc-500">
          {snapshot.pendingMigrations.length
            ? snapshot.pendingMigrations.join(", ")
            : "Nenhuma no registry"}
        </p>
        <Link
          href="/docs"
          className="text-[10px] text-zinc-600"
        >
          Ordem oficial: docs/operations/migration-order.md
        </Link>
      </section>
    </div>
  );
}
