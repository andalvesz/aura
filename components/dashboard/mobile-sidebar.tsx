"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { cn } from "@/utils/cn";

type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        id="mobile-sidebar"
        aria-hidden={!open}
        aria-label="Menu de módulos"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-white/[0.08] bg-zinc-950/95 pt-[env(safe-area-inset-top)] shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-12 items-center justify-between gap-2 border-b border-white/[0.06] px-3">
          <div>
            <Link
              href="/dashboard"
              onClick={onClose}
              className="text-[13px] font-semibold tracking-tight text-zinc-200"
            >
              Aura
            </Link>
            <p className="text-[10px] text-zinc-600">OS pessoal · Anderson Alves</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex size-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
          <DashboardNav onNavigate={onClose} />
        </div>
      </aside>
    </>
  );
}
