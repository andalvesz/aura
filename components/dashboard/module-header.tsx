import type { ReactNode } from "react";
import type { ModuleConfig } from "@/lib/modules";
import { ActionButton } from "./action-button";

type ModuleHeaderProps = {
  module: ModuleConfig;
  action?: { label: string; icon?: ReactNode };
};

export function ModuleHeader({ module, action }: ModuleHeaderProps) {
  const Icon = module.icon;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
          <Icon className={`size-4 ${module.accent}`} />
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
            {module.shortLabel}
          </p>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-[22px]">
            {module.label}
          </h1>
          <p className="mt-0.5 max-w-xl text-[12px] text-zinc-500">
            {module.description}
          </p>
        </div>
      </div>
      {action && (
        <ActionButton icon={action.icon}>{action.label}</ActionButton>
      )}
    </header>
  );
}
