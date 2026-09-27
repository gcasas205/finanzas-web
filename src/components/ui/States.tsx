import Link from "next/link";
import { AlertCircle, RotateCw } from "lucide-react";
import { buttonClasses } from "./Button";

/** Estado de error de una vista: qué pasó, en castellano, y cómo reintentar. */
export function ErrorState({
  title = "No pudimos cargar tus datos",
  message,
  onRetry,
  className = "min-h-[50vh]",
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={`flex items-center justify-center p-6 ${className}`}>
      <div className="surface w-full max-w-md p-6 text-center sm:p-8">
        <span className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-terra/15 text-terra-light">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="display mb-2 text-2xl text-paper">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-ink-300">{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={buttonClasses("secundario")}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}

/** Estado vacío: mensaje y, si aplica, la acción que lo resuelve. */
export function EmptyState({
  message,
  action,
  className = "py-12",
}: {
  message: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 px-4 text-center ${className}`}>
      <p className="text-sm italic text-ink-300">{message}</p>
      {action &&
        (action.href ? (
          <Link href={action.href} className={buttonClasses("secundario")}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={buttonClasses("secundario")}>
            {action.label}
          </button>
        ))}
    </div>
  );
}

/** Aviso cuando la última recarga falló pero hay datos anteriores en pantalla. */
export function StaleDataBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="surface mb-6 flex flex-col gap-3 border-terra-light/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm text-ink-200">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-terra-light" aria-hidden="true" />
        <span>No pudimos actualizar los datos: {message} Lo que ves puede estar desactualizado.</span>
      </p>
      <button type="button" onClick={onRetry} className={buttonClasses("secundario", "shrink-0")}>
        <RotateCw className="h-4 w-4" aria-hidden="true" />
        Reintentar
      </button>
    </div>
  );
}
