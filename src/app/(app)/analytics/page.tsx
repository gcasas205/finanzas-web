import { loadConfig } from "@/lib/sheets";
import Analytics from "@/components/views/Analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const config = await loadConfig();
  return <Analytics config={config} />;
}
