"use client";

import Dashboard from "@/components/views/Dashboard";
import type { AppConfig } from "@/types";

// Config comes from the layout's AppShell → DataProvider
// Dashboard fetches its own data via useTransactions()
export default function DashboardPage() {
  // We need config for Dashboard, but it's already loaded in the layout.
  // For now, Dashboard is a client component that receives config as prop.
  // We'll pass a minimal placeholder and let the component handle data fetching.
  return null;
}
