"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppConfig } from "@/types";
import SetupWizard from "@/components/SetupWizard";
import LogoLoader from "@/components/LogoLoader";

interface Props {
  initialConfig: AppConfig;
  envReady?: boolean;
}

export default function MainClient({ initialConfig, envReady = false }: Props) {
  const router = useRouter();
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
    return <LogoLoader className="min-h-screen" label="Verificando configuración…" />;
  }

  if (!setupDone) {
    return (
      <SetupWizard
        onComplete={async () => {
          setSetupDone(true);
          router.push("/dashboard");
        }}
      />
    );
  }

  // Si ya está configurado y llega aquí, redirigimos
  useEffect(() => {
    if (setupDone) {
      router.push("/dashboard");
    }
  }, [setupDone, router]);

  return null;
}
