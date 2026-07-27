"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Building2, User } from "lucide-react";
import { switchAuraContextAction } from "@/app/actions/workspace";
import { cn } from "@/utils/cn";
import type { AuraActiveContext } from "@/types/database";

export type ContextWorkspaceOption = {
  id: string;
  name: string;
  slug: string;
};

type ContextSwitcherProps = {
  activeContext: AuraActiveContext;
  activeWorkspaceId: string | null;
  workspaces: ContextWorkspaceOption[];
  className?: string;
};

export function ContextSwitcher({
  activeContext,
  activeWorkspaceId,
  workspaces,
  className,
}: ContextSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const alvesz = workspaces.find((w) => w.slug === "alvesz") ?? workspaces[0] ?? null;

  function switchTo(context: AuraActiveContext, workspaceId?: string | null) {
    const fd = new FormData();
    fd.set("context", context);
    if (workspaceId) fd.set("workspaceId", workspaceId);
    startTransition(async () => {
      await switchAuraContextAction(fd);
      router.refresh();
    });
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
        Contexto
      </p>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => switchTo("personal")}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
            activeContext === "personal"
              ? "bg-white/[0.08] text-zinc-100"
              : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
          )}
        >
          <User className="size-3.5 shrink-0" />
          Pessoal
        </button>
        {alvesz ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => switchTo("workspace", alvesz.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
              activeContext === "workspace" && activeWorkspaceId === alvesz.id
                ? "bg-white/[0.08] text-zinc-100"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            )}
          >
            <Building2 className="size-3.5 shrink-0 text-violet-400" />
            {alvesz.name}
          </button>
        ) : null}
      </div>
    </div>
  );
}
