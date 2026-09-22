// Fallback de carga para todo el segmento (app), mientras se navega a una
// sección que todavía no está prefetcheada. Server Component: no necesita
// interactividad, por eso puede usar LogoLoader (un componente sin estado).

import LogoLoader from "@/components/LogoLoader";

export default function Loading() {
  return <LogoLoader className="min-h-[70vh]" label="Cargando sección…" />;
}
