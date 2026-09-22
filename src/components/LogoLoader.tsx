/**
 * Estado de carga unificado: el mark "F." de la marca con un anillo ámbar
 * girando alrededor. Reemplaza los textos sueltos de "Cargando..." y los
 * skeletons de bloques grises en toda la app.
 */
export default function LogoLoader({
  className = "min-h-[50vh]",
  label = "Cargando…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 ${className}`}
    >
      <div className="relative w-16 h-16 shrink-0">
        <svg className="absolute -inset-2 w-20 h-20 animate-spin" viewBox="0 0 40 40" fill="none">
          <circle
            cx="20" cy="20" r="17"
            stroke="#C9A24B" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="30 78"
          />
        </svg>
        <div className="absolute inset-0 rounded-xl bg-ink-900 border border-ink-600 flex items-center justify-center">
          <span className="display text-2xl text-paper leading-none">
            F<span className="text-amber italic">.</span>
          </span>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
