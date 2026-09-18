import { loadConfig } from "@/lib/sheets";
import ImportView from "@/components/views/ImportView";

export default async function ImportPage() {
  const config = await loadConfig();
  return <ImportView config={config} />;
}