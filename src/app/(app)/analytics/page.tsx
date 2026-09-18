import { loadConfig } from "@/lib/sheets";
import Analytics from "@/components/views/Analytics";

export default async function AnalyticsPage() {
  const config = await loadConfig();
  return <Analytics config={config} />;
}