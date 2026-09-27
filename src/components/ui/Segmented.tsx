"use client";

import { cn } from "@/lib/utils";

/**
 * Control segmentado (elegir una opción de pocas). Lo elegido va en la voz de
 * selección (neutro fuerte), nunca en el color de marca: el ámbar es para la
 * acción principal y la ubicación en la navegación.
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
  options: Array<{ value: NoInfer<T>; label: string }>;
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
                ? "bg-seleccion font-medium text-seleccion-tinta"
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
