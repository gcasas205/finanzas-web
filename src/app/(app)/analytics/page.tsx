"use client";

import Analytics from "@/components/views/Analytics";
import { useConfig } from "@/components/ConfigProvider";

export default function AnalyticsPage() {
  return <Analytics config={useConfig()} />;
}