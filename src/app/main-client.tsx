"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppConfig } from "@/types";
import SetupWizard from "@/components/SetupWizard";
import { useFaviconLoading } from "@/components/FaviconLoadingSignal";

interface Props {
  initialConfig: AppConfig;
  envReady?: boolean;
}

export default function MainClient({ initialConfig, envReady = false }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [checking, setChecking] = useState(!envReady);
  const [setupDone, setSetupDone] = useState(envReady);
  useFaviconLoading(checking);

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
        <div className="text-ink-300 text-sm animate-pulse" role="status" aria-live="polite">Verificando configuración...</div>
      </div>
    );
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
