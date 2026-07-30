"use client";

import { useEffect, useRef, useState } from "react";
import { useSmartCapture } from "@/components/dashboard/smart-capture/smart-capture-context";

/** Global drag-and-drop — dropping files anywhere opens Quick Capture. */
export function GlobalDropCapture() {
  const { openCapture } = useSmartCapture();
  const [active, setActive] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setActive(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setActive(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) openCapture({ files });
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [openCapture]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-cyan-950/50 backdrop-blur-sm"
      data-testid="global-drop-overlay"
      aria-hidden
    >
      <div className="rounded-xl border border-cyan-400/40 bg-zinc-950/90 px-6 py-4 text-center">
        <p className="text-[15px] font-medium text-cyan-100">Solte para capturar</p>
        <p className="mt-1 text-[12px] text-zinc-400">
          Abre o Smart Capture com os arquivos
        </p>
      </div>
    </div>
  );
}
