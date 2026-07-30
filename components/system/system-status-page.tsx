"use client";

import Link from "next/link";

type SystemStatusPageProps = {
  code: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  testId?: string;
};

export function SystemStatusPage({
  code,
  title,
  description,
  primaryHref = "/",
  primaryLabel = "Ir para o início",
  secondaryHref,
  secondaryLabel,
  testId,
}: SystemStatusPageProps) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100"
      data-testid={testId}
    >
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          {code}
        </p>
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        <p className="text-[14px] leading-relaxed text-zinc-400">{description}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href={primaryHref}
            className="inline-flex min-h-11 items-center rounded-md bg-cyan-500/90 px-4 text-[13px] font-medium text-zinc-950"
          >
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-11 items-center rounded-md border border-white/10 px-4 text-[13px] text-zinc-300"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
