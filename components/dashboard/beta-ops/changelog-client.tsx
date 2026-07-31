"use client";

import { useState, useTransition } from "react";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { markChangelogReadAction } from "@/app/actions/beta-ops";
import type { AnnouncementRecord, ReleaseRecord } from "@/lib/beta-ops/types";

type Props = {
  releases: ReleaseRecord[];
  announcements: AnnouncementRecord[];
  currentVersion: string;
  readReleaseIds: string[];
};

export function ChangelogClient({
  releases,
  announcements,
  currentVersion,
  readReleaseIds,
}: Props) {
  const [read, setRead] = useState(new Set(readReleaseIds));
  const [, start] = useTransition();

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-testid="changelog">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Changelog" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Changelog</h1>
        <p className="text-[12px] text-zinc-500">
          Versão atual: <span data-testid="current-version">{currentVersion}</span>
        </p>
      </div>

      {announcements.length > 0 && (
        <section className="space-y-2" data-testid="announcements">
          <h2 className="text-[13px] font-medium text-zinc-300">Anúncios</h2>
          {announcements.map((a) => (
            <div
              key={a.id}
              className="border border-white/[0.06] px-3 py-2 text-[12px] text-zinc-400"
            >
              <p className="font-medium text-zinc-200">{a.title}</p>
              <p>{a.body}</p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        {releases.length === 0 && (
          <p className="text-[12px] text-zinc-500">Nenhuma release publicada.</p>
        )}
        {releases.map((r) => (
          <article
            key={r.id}
            className="space-y-2 border border-white/[0.06] p-3"
            data-testid={`release-${r.version}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[14px] font-medium text-zinc-100">
                {r.version} — {r.title}
              </h2>
              <span className="text-[10px] uppercase text-zinc-500">{r.channel}</span>
            </div>
            <p className="text-[12px] text-zinc-400">{r.summary}</p>
            <ul className="space-y-1 text-[12px] text-zinc-400">
              {r.changes.map((c, i) => (
                <li key={i}>
                  <span className="text-zinc-500">[{c.kind}]</span> {c.text}
                </li>
              ))}
            </ul>
            {r.knownIssues.length > 0 && (
              <div className="text-[12px] text-amber-200/80">
                Problemas conhecidos: {r.knownIssues.join("; ")}
              </div>
            )}
            {r.migrationRequired && (
              <p className="text-[11px] text-zinc-500">Migration necessária (manual).</p>
            )}
            {!read.has(r.id) && (
              <button
                type="button"
                className="text-[11px] text-zinc-300 underline"
                data-testid={`mark-read-${r.id}`}
                onClick={() =>
                  start(async () => {
                    await markChangelogReadAction(r.id);
                    setRead((s) => new Set(s).add(r.id));
                  })
                }
              >
                Marcar como lido
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
