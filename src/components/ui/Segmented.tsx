"use client";

import { cn } from "@/lib/utils";

/** Opción elegida con color de dirección: entra plata (positivo) o sale (negativo). */
export type SegmentTone = "positivo" | "negativo";

const TONE_SELECTED: Record<SegmentTone, string> = {
  positivo: "bg-moss/15 font-medium text-moss-light ring-1 ring-inset ring-moss",
  negativo: "bg-terra/15 font-medium text-terra-light ring-1 ring-inset ring-terra",
};

/**
 * Control segmentado (elegir una opción de pocas). Lo elegido va en la voz de
 * selección (neutro fuerte), nunca en el color de marca. Si la opción es una
 * dirección de plata (gasto/ingreso, compra/venta) puede llevar `tone`.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  attached = false,
  size = "md",
  className,
}: {
  /** Nombre accesible del grupo. */
  label: string;
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: Array<{ value: NoInfer<T>; label: string; tone?: SegmentTone }>;
  /** Pegado a la derecha de un input (sin borde izquierdo). */
  attached?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex shrink-0 border border-control",
        attached ? "border-l-0" : "w-full",
        className,
      )}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 px-4 text-sm transition-colors",
              size === "md" ? "min-h-11" : "min-h-9 px-3 text-xs uppercase tracking-[0.08em]",
              attached && "font-mono",
              selected
                ? o.tone
                  ? TONE_SELECTED[o.tone]
                  : "bg-seleccion font-medium text-seleccion-tinta"
                : "text-ink-200 hover:bg-ink-700/40 hover:text-paper",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
