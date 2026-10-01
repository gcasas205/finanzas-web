"use client";

import { cn } from "@/lib/utils";

export type Rango = 12 | 6 | 3;
const RANGOS: Rango[] = [12, 6, 3];

/**
 * Selector chico de período para un gráfico: últimos 12, 6 o 3 meses. Va en la
 * esquina del gráfico, discreto: lo elegido en la voz de selección, el resto en
 * texto apagado. El área táctil se agranda con un pseudo-elemento (44px).
 */
export function RangoMeses({ value, onChange, className }: {
  value: Rango;
  onChange: (r: Rango) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Período del gráfico" className={cn("inline-flex items-center gap-1 shrink-0", className)}>
      {RANGOS.map((r) => {
        const elegido = r === value;
        return (
          <button
            key={r}
            type="button"
            aria-pressed={elegido}
            aria-label={`Últimos ${r} meses`}
            onClick={() => onChange(r)}
            className={cn(
              "relative h-7 min-w-9 px-2 text-xs font-mono tabular rounded-sm transition-colors",
              "after:absolute after:-inset-x-0.5 after:-inset-y-2 after:content-['']",
              elegido ? "bg-seleccion text-seleccion-tinta font-medium" : "text-ink-300 hover:text-paper",
            )}
          >
            {r}m
          </button>
        );
      })}
    </div>
  );
}
