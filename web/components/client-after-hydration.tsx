"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const emptySubscribe = () => () => {};

/**
 * Shows `fallback` on the server and for the hydrating client paint, then `children`.
 * Helps avoid hydration mismatches when browser extensions mutate form-like controls (`fdprocessedid`, etc.).
 */
export function ClientAfterHydration(props: { fallback: ReactNode; children: ReactNode }) {
  const ready = useSyncExternalStore(emptySubscribe, () => true, () => false);
  return ready ? props.children : props.fallback;
}
