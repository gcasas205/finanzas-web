import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primario" | "secundario" | "fantasma" | "peligro" | "exito";

const VARIANTS: Record<ButtonVariant, string> = {
  // Marca: el único primario de la vista.
  primario: "bg-amber text-ink-900 font-medium hover:bg-amber-light",
  secundario: "border border-control text-paper hover:border-ink-300 hover:bg-ink-700/40",
  fantasma: "text-ink-300 hover:text-paper",
  peligro: "bg-terra-light text-ink-900 font-medium hover:bg-terra-light/90",
  // Confirmar algo que suma (importar, terminar la configuración). paper/moss = 6.7:1.
  exito: "bg-moss text-paper font-medium hover:bg-moss/85",
};

export function buttonClasses(variant: ButtonVariant = "primario", className?: string) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm transition-all active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
    VARIANTS[variant],
    className,
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; isLoading?: boolean }
>(({ variant = "primario", isLoading = false, disabled, type = "button", className, children, ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    className={buttonClasses(variant, className)}
    {...props}
  >
    {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
    {children}
  </button>
));
Button.displayName = "Button";
