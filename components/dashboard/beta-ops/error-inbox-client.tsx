"use client";

import { useTransition } from "react";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { updateErrorStatusAction } from "@/app/actions/beta-ops";
import type { ErrorGroupStatus } from "@/lib/beta-ops/types";

type ErrorRow = {
  id: string;
  code: string;
  route: string | null;
  version: string | null;
  environment: string;
  workspaceAnonId: string | null;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  status: ErrorGroupStatus;
  sampleMessage: string;
};

type Props = { initial: ErrorRow[]; denied?: boolean };

export function ErrorInboxClient({ initial, denied }: Props) {
  const [, start] = useTransition();

  if (denied) {
    return (
      <div className="p-6 text-[13px] text-zinc-400" data-testid="error-inbox-denied">
        Acesso negado.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-testid="error-inbox">
      <PageBreadcrumb
        items={[
          { label: "Admin", href: "/dashboard/admin/platform" },
          { label: "Errors" },
        ]}
      />
      <h1 className="text-lg font-medium text-zinc-100">Error Inbox</h1>
      <p className="text-[12px] text-zinc-500">
        Agrupado e anonimizado — sem stacks ou payloads sensíveis.
      </p>
      <div className="space-y-2">
        {initial.map((g) => (
          <div
            key={g.id}
            className="border border-white/[0.06] px-3 py-2 text-[12px]"
            data-testid={`error-group-${g.id}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-zinc-200">{g.code}</span>
              <span className="text-zinc-500">
                ×{g.frequency} · {g.status}
              </span>
            </div>
            <p className="text-zinc-400">{g.sampleMessage}</p>
            <p className="text-[11px] text-zinc-600">
              {g.route ?? "—"} · {g.environment} · ws:{g.workspaceAnonId ?? "—"}
            </p>
            <select
              className="mt-1 rounded border border-white/[0.08] bg-zinc-900 px-2 py-0.5 text-[11px]"
              defaultValue={g.status}
              onChange={(e) =>
                start(async () => {
                  await updateErrorStatusAction(g.id, e.target.value as ErrorGroupStatus);
                })
              }
            >
              {(
                ["OPEN", "INVESTIGATING", "MONITORING", "RESOLVED", "IGNORED"] as ErrorGroupStatus[]
              ).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
