import { loadConfig } from "@/lib/sheets";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const config = await loadConfig();
  const envReady = Boolean(process.env.GOOGLE_SHEETS_CREDS_JSON && process.env.GOOGLE_SHEET_ID);
  
  if (!envReady) {
    redirect("/");
  }

  return (
    <AppShell initialConfig={config}>
      {children}
    </AppShell>
  );
}
