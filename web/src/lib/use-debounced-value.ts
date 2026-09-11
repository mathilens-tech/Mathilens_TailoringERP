"use client";

import { useEffect, useState } from "react";

/** 00_MASTER_SPEC.md § 9.7 Search — debounced, server-side search, never a client-side filter over an unbounded list. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
