import { loadConfig } from "@/lib/sheets";
import SettingsView from "@/components/views/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const config = await loadConfig();
  return <SettingsView config={config} />;
}
