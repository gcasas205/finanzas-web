"use client";

import { useState } from "react";
import type { AppConfig } from "@/types";
import SetupWizard from "@/components/SetupWizard";
import AppShell from "@/components/AppShell";

interface Props {
  initialConfig: AppConfig;
}

export default function MainClient({ initialConfig }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [setupDone, setSetupDone] = useState(
    Boolean(config.googleSheetId && config.googleCredsPath)
  );

  if (!setupDone) {
    return (
      <SetupWizard
        onComplete={async () => {
          const r = await fetch("/api/config");
          const data = await r.json();
          setConfig(data.config);
          setSetupDone(true);
        }}
      />
    );
  }

  return <AppShell initialConfig={config} />;
}
