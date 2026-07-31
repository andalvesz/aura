/**
 * Clear client-side personal state on logout / account switch.
 * Offline queues stay namespaced by userId — we do NOT wipe other users' offline data.
 */

const AURA_PERSONAL_STORAGE_PREFIXES = [
  "aura:",
  "aura-",
  "aura_",
] as const;

function shouldClearKey(key: string, currentUserId?: string | null): boolean {
  const lower = key.toLowerCase();
  if (!AURA_PERSONAL_STORAGE_PREFIXES.some((p) => lower.startsWith(p))) {
    return false;
  }
  // Never wipe another account's offline namespace
  if (lower.includes("aura-offline:")) {
    if (!currentUserId) return false;
    return lower.includes(currentUserId.toLowerCase());
  }
  return true;
}

export function clearClientPersonalState(options?: {
  currentUserId?: string | null;
}): void {
  if (typeof window === "undefined") return;
  const currentUserId = options?.currentUserId ?? null;

  try {
    const lsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) lsKeys.push(k);
    }
    for (const k of lsKeys) {
      if (shouldClearKey(k, currentUserId)) localStorage.removeItem(k);
    }
  } catch {
    // private mode
  }

  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }

  try {
    window.dispatchEvent(
      new CustomEvent("aura:session-reset", {
        detail: { at: Date.now(), userId: currentUserId },
      })
    );
  } catch {
    // ignore
  }
}
