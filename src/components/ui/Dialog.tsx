"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const EASE_SALIDA = [0.16, 1, 0.3, 1] as const;

/**
 * Diálogo modal accesible: role="dialog" + aria-modal + aria-labelledby, foco
 * inicial ([data-autofocus] o el primer control), trampa de Tab, Escape, bloqueo
 * de scroll del fondo y foco devuelto al disparador al cerrar. Anima entrada y
 * salida (260ms). En celular es una hoja inferior; desde `sm`, centrado.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <DialogPanel onClose={onClose} title={title} eyebrow={eyebrow} size={size}>
          {children}
        </DialogPanel>
      )}
    </AnimatePresence>
  );
}

function DialogPanel({
  onClose,
  title,
  eyebrow,
  size,
  children,
}: {
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  size: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Foco inicial: [data-autofocus], si no el primer control del cuerpo (no la X).
    const body = panel?.querySelector<HTMLElement>("[data-dialog-body]");
    const initial =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      body?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel;
    initial?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/80 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.26, ease: EASE_SALIDA }}
        className={cn(
          "surface-elevated w-full overflow-y-auto rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-none sm:p-8",
          "max-h-[92vh] sm:max-h-[90vh]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-xl",
          size === "lg" && "sm:max-w-2xl",
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            <h2 id={titleId} className="display text-2xl text-paper sm:text-3xl">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-3 -mt-1 p-3 text-ink-300 transition-colors hover:text-paper"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div data-dialog-body>{children}</div>
      </motion.div>
    </motion.div>
  );
}

/** Pie de diálogo: secundario a la izquierda (fantasma), acción a la derecha. */
export function DialogActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-ink-600/60 pt-5 sm:mt-8 sm:flex-row sm:justify-end sm:pt-6">
      {children}
    </div>
  );
}
