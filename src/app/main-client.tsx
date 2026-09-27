"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppConfig } from "@/types";
import SetupWizard from "@/components/SetupWizard";
import LogoLoader from "@/components/LogoLoader";
import { configApi } from "@/lib/api";

interface Props {
  initialConfig: AppConfig;
  envReady?: boolean;
}

export default function MainClient({ initialConfig, envReady = false }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(!envReady);
  const [setupDone, setSetupDone] = useState(envReady);

  // Double-check via API if server prop says not ready
  useEffect(() => {
    if (envReady) return; // Already ready from server prop

    configApi
      .health()
      .then(data => {
        if (data.envReady) {
          setSetupDone(true);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [envReady]);

  // Si ya está configurado, vamos al resumen. (Antes este efecto estaba después
  // de los return condicionales: violaba las reglas de los hooks.)
  useEffect(() => {
    if (setupDone) router.push("/dashboard");
  }, [setupDone, router]);

  if (checking) {
    return <LogoLoader className="min-h-screen" label="Verificando configuración…" />;
  }

  if (!setupDone) {
    return (
      <SetupWizard
        onComplete={() => setSetupDone(true)}
      />
    );
  }

  return <LogoLoader className="min-h-screen" />;
}
