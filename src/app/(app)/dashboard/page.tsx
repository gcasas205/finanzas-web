import { loadConfig } from "@/lib/sheets";
import Dashboard from "@/components/views/Dashboard";

// Sin `force-dynamic`: la config es constante por deploy en Vercel (env vars),
// así la ruta se prerenderiza estática y Next puede prefetchearla → navegación instantánea.
// Los datos vivos (transacciones, dólar) los trae el DataProvider client-side vía SWR.
export default async function DashboardPage() {
  const config = await loadConfig();
  return <Dashboard config={config} />;
}