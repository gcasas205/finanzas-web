"use client";

import { useState, useEffect } from "react";
import type { AppConfig } from "@/types";
import SetupWizard from "@/components/SetupWizard";
import AppShell from "@/components/AppShell";

interface Props {
  initialConfig: AppConfig;
  envReady?: boolean;
}

export default function MainClient({ initialConfig, envReady = false }: Props) {
  const [config, setConfig] = useState(initialConfig);
  const [checking, setChecking] = useState(!envReady);
  const [setupDone, setSetupDone] = useState(envReady);

  // Double-check via API if server prop says not ready
  useEffect(() => {
    if (envReady) return; // Already ready from server prop

    fetch("/api/health")
      .then(r => r.json())
      .then(data => {
        if (data.envReady) {
          setSetupDone(true);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [envReady]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ink-300 text-sm animate-pulse">Verificando configuración...</div>
      </div>
    );
  }

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
