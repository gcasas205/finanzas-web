"use client";

import ImportView from "@/components/views/ImportView";
import { useConfig } from "@/components/ConfigProvider";

export default function ImportPage() {
  return <ImportView config={useConfig()} />;
}