"use client";

import Dashboard from "@/components/views/Dashboard";
import { useConfig } from "@/components/ConfigProvider";

export default function DashboardPage() {
  return <Dashboard config={useConfig()} />;
}