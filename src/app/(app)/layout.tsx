import { loadConfig } from "@/lib/sheets";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { ConfigProvider } from "@/components/ConfigProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const config = await loadConfig();
  const envReady = Boolean(process.env.GOOGLE_SHEETS_CREDS_JSON && process.env.GOOGLE_SHEET_ID);

  if (!envReady) {
    redirect("/");
  }

  // `config` del SSR siembra el provider; SWR lo mantiene en vivo contra /api/config.
  return (
    <ConfigProvider initialConfig={config}>
      <AppShell initialConfig={config}>
        {children}
      </AppShell>
    </ConfigProvider>
  );
}
