"use client";

import { useEffect, useRef, useState } from "react";
import { UsdAmount } from "@/components/UsdAmount";

/**
 * Anima un número contando desde 0 hasta `value` cada vez que cambia
 * (incluido el montaje inicial, que es el caso de uso principal: al entrar
 * a una sección, los números "cargan" hasta su valor real). Usa easeOutCubic
 * y respeta prefers-reduced-motion saltando directo al valor final.
 */
export function useAnimatedNumber(value: number, durationMs = 650): number {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);

    if (!isFinite(value)) {
      setDisplay(0);
      return;
    }

    const reduceMotion = typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const from = 0;
    const to = value;
    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(from + (to - from) * easeOutCubic(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return display;
}

/** Versión como componente: aplica `format` al número animado en cada frame. */
export default function AnimatedNumber({
  value,
  format,
  durationMs = 650,
  className,
}: {
  value: number;
  format: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const display = useAnimatedNumber(value, durationMs);
  // El lector de pantalla lee sólo el valor final; el conteo es decorativo.
  return (
    <span className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(display)}</span>
    </span>
  );
}

/** Igual que AnimatedNumber, pero formateado como monto en USD (vía UsdAmount). */
export function AnimatedUsdAmount({
  value,
  symbol,
  className,
  durationMs = 650,
}: {
  value: number;
  symbol?: boolean;
  className?: string;
  durationMs?: number;
}) {
  const display = useAnimatedNumber(value, durationMs);
  return (
    <span className={className}>
      <span className="sr-only"><UsdAmount value={value} symbol={symbol} /></span>
      <span aria-hidden="true"><UsdAmount value={display} symbol={symbol} /></span>
    </span>
  );
}
