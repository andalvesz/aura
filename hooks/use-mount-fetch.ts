"use client";

import { useEffect, type DependencyList } from "react";

/** Runs fetch on mount without synchronous setState inside the effect body. */
export function useMountFetch(
  fetchFn: () => void | Promise<void>,
  deps: DependencyList
): void {
  useEffect(() => {
    queueMicrotask(() => {
      void fetchFn();
    });
  }, deps);
}
