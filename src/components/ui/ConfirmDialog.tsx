"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogActions } from "./Dialog";
import { Button } from "./Button";

interface ConfirmOptions {
  title: string;
  /** Qué se va a hacer y sobre qué registro, en una línea. */
  description: ReactNode;
  confirmLabel?: string;
}

/**
 * Reemplazo de window.confirm: diálogo con contexto, botón de peligro y
 * "Cancelar" fantasma. Uso:
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title, description }))) return;
 *   ...
 *   return <>{...}{dialog}</>;
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  // Se conservan las opciones mientras corre la animación de salida.
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const dialog = (
    <Dialog open={open} onClose={() => close(false)} title={opts?.title ?? ""} size="sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terra/15 text-terra-light">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-sm leading-relaxed text-ink-200">{opts?.description}</p>
      </div>
      <DialogActions>
        <Button variant="fantasma" onClick={() => close(false)}>
          Cancelar
        </Button>
        <Button variant="peligro" onClick={() => close(true)} data-autofocus>
          {opts?.confirmLabel ?? "Eliminar"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { confirm, dialog };
}
