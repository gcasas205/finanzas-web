// Fallback de carga para todo el segmento (app).
// Con las rutas ya estáticas y prefetcheadas la transición es casi instantánea,
// así que este skeleton actúa sobre todo como red de seguridad (primer acceso a
// una sección aún no prefetcheada) y evita que la UI se "congele" sin feedback.
// Server Component: no necesita interactividad (salvo el favicon, ver abajo).

import FaviconLoadingSignal from "@/components/FaviconLoadingSignal";

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-ink-700/60 ${className}`} />;
}

function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`surface p-4 sm:p-7 ${className}`}>
      <Block className="h-2.5 w-20 mb-4" />
      <Block className="h-7 w-32 mb-2" />
      <Block className="h-2 w-16" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-[1400px]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando sección…</span>
      <FaviconLoadingSignal active />

      {/* Header: eyebrow + título */}
      <header className="mb-6 lg:mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Block className="h-2.5 w-24 mb-3" />
          <Block className="h-9 w-56" />
        </div>
        <Block className="h-9 w-40" />
      </header>

      {/* Fila de métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 sm:gap-6 mb-8 lg:mb-12">
        <CardSkeleton className="col-span-1 sm:col-span-4" />
        <CardSkeleton className="col-span-1 sm:col-span-4" />
        <CardSkeleton className="col-span-2 sm:col-span-4" />
      </div>

      {/* Bloque principal (gráfico / tabla) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6">
        <div className="surface p-4 sm:p-7 col-span-1 sm:col-span-8">
          <Block className="h-2.5 w-28 mb-6" />
          <Block className="h-56 w-full" />
        </div>
        <div className="surface p-4 sm:p-7 col-span-1 sm:col-span-4">
          <Block className="h-2.5 w-24 mb-6" />
          <div className="space-y-3">
            <Block className="h-4 w-full" />
            <Block className="h-4 w-5/6" />
            <Block className="h-4 w-4/6" />
            <Block className="h-4 w-3/6" />
          </div>
        </div>
      </div>
    </div>
  );
}