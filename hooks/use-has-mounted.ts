"use client";

import { useEffect, useState } from "react";

/** true apenas após o primeiro commit no cliente (evita mismatch SSR). */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
