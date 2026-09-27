"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Props que el control tiene que esparcir: así nadie se olvida de cablear la accesibilidad. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

/**
 * Etiqueta + control + ayuda/error. El error reemplaza a la ayuda (no se apilan)
 * y se anuncia porque el control lo referencia con aria-describedby.
 *
 *   <Field label="Monto" error={errors.monto}>{(c) => <input {...c} className="form-input" />}</Field>
 */
export function Field({
  label,
  hint,
  error,
  required,
  extra,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  /** Algo al lado de la etiqueta (p. ej. el tilde "Auto"); va fuera del <label>. */
  extra?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const msgId = error || hint ? `${id}-msg` : undefined;
  const control: FieldControlProps = {
    id,
    "aria-describedby": msgId,
    "aria-invalid": error ? true : undefined,
    "aria-required": required ? true : undefined,
  };
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="eyebrow flex items-baseline gap-1 whitespace-nowrap">
          {label}
          {required && <span className="text-terra-light" aria-hidden="true">*</span>}
        </label>
        {extra}
      </div>
      {children(control)}
      {(error || hint) && (
        <p
          id={msgId}
          className={cn("mt-1.5 text-xs leading-relaxed", error ? "font-semibold text-terra-light" : "text-ink-300")}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

/** Lleva el foco al primer control inválido dentro de `root` (tras fallar un envío). */
export function focusFirstInvalid(root: HTMLElement | null) {
  requestAnimationFrame(() => {
    root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
