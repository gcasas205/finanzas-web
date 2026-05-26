import { loadConfig } from "@/lib/sheets";
import MainClient from "./main-client";

export default async function Home() {
  const config = await loadConfig();
  // Check if credentials are available (either file path or env var)
  const hasCredsEnv = Boolean(process.env.GOOGLE_SHEETS_CREDS_JSON);
  const hasSheetEnv = Boolean(process.env.GOOGLE_SHEET_ID);
  return (
    <MainClient
      initialConfig={config}
      envReady={hasCredsEnv && hasSheetEnv}
    />
  );
}
