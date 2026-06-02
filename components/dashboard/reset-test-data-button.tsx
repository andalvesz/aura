"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseJsonResponse } from "@/utils/safe-json";
import type { ResetTestDataCounts } from "@/utils/reset-test-data";

type ResetTestDataButtonProps = {
  visible: boolean;
};

export function ResetTestDataButton({ visible }: ResetTestDataButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!visible) return null;

  async function handleReset() {
    const confirmed = confirm(
      "Apagar TODOS os seus dados de teste nas tabelas do Aura OS?\n\nEsta ação não pode ser desfeita."
    );
    if (!confirmed) return;

    setPending(true);
    try {
      const res = await fetch("/api/dev/reset-test-data", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        ok?: boolean;
        counts?: ResetTestDataCounts;
        error?: string;
      }>(res);

      if (parseError) {
        toast.error(parseError);
        return;
      }

      if (!res.ok || data?.error) {
        toast.error(data?.error ?? "Não foi possível resetar os dados.");
        return;
      }

      toast.success("Dados de teste removidos. Sistema pronto para uso real.");
      router.refresh();
      window.location.reload();
    } catch {
      toast.error("Erro de conexão ao resetar dados.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={pending}
      className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 text-[11px] text-amber-200/90 transition-colors hover:bg-amber-500/15 disabled:opacity-50 sm:px-2.5 sm:text-[12px]"
      title="Remove registros de teste do usuário atual (apenas desenvolvimento)"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Trash2 className="size-3" />
      )}
      <span className="hidden sm:inline">Resetar dados de teste</span>
      <span className="sm:hidden">Reset</span>
    </button>
  );
}
