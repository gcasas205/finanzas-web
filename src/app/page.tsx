import { loadConfig } from "@/lib/sheets";
import MainClient from "./main-client";

export default async function Home() {
  const config = await loadConfig();
  return <MainClient initialConfig={config} />;
}
