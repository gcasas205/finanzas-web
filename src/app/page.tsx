import { loadConfig } from "@/lib/sheets";
import MainClient from "./main-client";

// Force dynamic rendering - never cache this page
export const dynamic = "force-dynamic";

export default async function Home() {
  const config = await loadConfig();
  const hasCredsEnv = Boolean(process.env.GOOGLE_SHEETS_CREDS_JSON);
  const hasSheetEnv = Boolean(process.env.GOOGLE_SHEET_ID);
  return (
    <MainClient
      initialConfig={config}
      envReady={hasCredsEnv && hasSheetEnv}
    />
  );
}
