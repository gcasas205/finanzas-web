"use client";

import SettingsView from "@/components/views/SettingsView";
import { useConfig } from "@/components/ConfigProvider";

export default function SettingsPage() {
  return <SettingsView config={useConfig()} />;
}