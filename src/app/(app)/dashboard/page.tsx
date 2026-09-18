import { loadConfig } from "@/lib/sheets";
import Dashboard from "@/components/views/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const config = await loadConfig();
  return <Dashboard config={config} />;
}
