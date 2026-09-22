"use client";

import { useEffect } from "react";
import { acquireFaviconLoading } from "@/lib/favicon-loading";

/** Mientras `active` sea true, el favicon gira su anillo ámbar (ver lib/favicon-loading). */
export function useFaviconLoading(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return acquireFaviconLoading();
  }, [active]);
}

/**
 * Versión como componente para poder señalizar carga desde un Server Component
 * (ej. app/(app)/loading.tsx), que no puede usar hooks directamente.
 */
export default function FaviconLoadingSignal({ active }: { active: boolean }) {
  useFaviconLoading(active);
  return null;
}
