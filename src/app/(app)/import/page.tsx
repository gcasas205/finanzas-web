import { loadConfig } from "@/lib/sheets";
import ImportView from "@/components/views/ImportView";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const config = await loadConfig();
  return <ImportView config={config} />;
}
