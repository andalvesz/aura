"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/utils/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar"
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          "relative flex min-w-0 max-h-[min(92dvh,100%)] w-full max-w-[min(100vw,28rem)] flex-col overflow-hidden rounded-t-2xl border border-white/[0.08] bg-zinc-900 shadow-2xl sm:max-h-[min(85vh,720px)] sm:max-w-md sm:rounded-xl",
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.06] px-4 pb-3 pt-4 sm:border-0 sm:px-4 sm:pt-4">
          <div className="min-w-0 pr-2">
            <h2 className="text-[15px] font-semibold text-zinc-100">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[12px] text-zinc-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 sm:size-8"
          >
            <X className="size-5 sm:size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
