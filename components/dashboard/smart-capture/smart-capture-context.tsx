"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CaptureAttachmentInput } from "@/lib/smart-capture/types";

type SmartCaptureOpenOptions = {
  files?: File[];
  initialText?: string;
  initialLinks?: string[];
  seedAttachments?: CaptureAttachmentInput[];
};

type SmartCaptureContextValue = {
  open: boolean;
  openCapture: (opts?: SmartCaptureOpenOptions) => void;
  closeCapture: () => void;
  pendingFiles: File[];
  initialText: string;
  initialLinks: string[];
  seedAttachments: CaptureAttachmentInput[];
  clearPending: () => void;
};

const SmartCaptureContext = createContext<SmartCaptureContextValue | null>(
  null
);

export function SmartCaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [initialText, setInitialText] = useState("");
  const [initialLinks, setInitialLinks] = useState<string[]>([]);
  const [seedAttachments, setSeedAttachments] = useState<
    CaptureAttachmentInput[]
  >([]);

  const openCapture = useCallback((opts?: SmartCaptureOpenOptions) => {
    setPendingFiles(opts?.files ?? []);
    setInitialText(opts?.initialText ?? "");
    setInitialLinks(opts?.initialLinks ?? []);
    setSeedAttachments(opts?.seedAttachments ?? []);
    setOpen(true);
  }, []);

  const closeCapture = useCallback(() => {
    setOpen(false);
  }, []);

  const clearPending = useCallback(() => {
    setPendingFiles([]);
    setInitialText("");
    setInitialLinks([]);
    setSeedAttachments([]);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        openCapture();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCapture]);

  const value = useMemo(
    () => ({
      open,
      openCapture,
      closeCapture,
      pendingFiles,
      initialText,
      initialLinks,
      seedAttachments,
      clearPending,
    }),
    [
      open,
      openCapture,
      closeCapture,
      pendingFiles,
      initialText,
      initialLinks,
      seedAttachments,
      clearPending,
    ]
  );

  return (
    <SmartCaptureContext.Provider value={value}>
      {children}
    </SmartCaptureContext.Provider>
  );
}

export function useSmartCapture() {
  const ctx = useContext(SmartCaptureContext);
  if (!ctx) {
    throw new Error("useSmartCapture must be used within SmartCaptureProvider");
  }
  return ctx;
}
