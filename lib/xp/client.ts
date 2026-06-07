import type { XpAcao } from "@/types/database";
import { isXpAcao } from "@/utils/xp";

export async function awardAuraXpClient(acao: XpAcao): Promise<void> {
  try {
    await fetch("/api/xp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao }),
    });
  } catch {
    /* XP é complementar — não bloqueia a ação principal */
  }
}

export async function refreshAuraXpClient(): Promise<void> {
  try {
    await fetch("/api/xp", { cache: "no-store" });
  } catch {
    /* noop */
  }
}

export { isXpAcao };
