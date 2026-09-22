"use client";

import { createContext, useContext } from "react";
import useSWR from "swr";
import type { AppConfig } from "@/types";

/**
 * Provee la configuración de la app EN VIVO al árbol de componentes.
 *
 * Fuente de verdad: la hoja Config de Google Sheets, expuesta por `/api/config`
 * (ruta siempre dinámica). Se siembra con la config del SSR (`initialConfig`)
 * para el primer render, y SWR la revalida contra la API. Así, cuando Ajustes
 * guarda un cambio y llama a `refreshConfig()`, toda la app lo refleja al
 * instante, sin redeploy — pese a que las páginas son estáticas por performance.
 */

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ConfigContextValue {
  config: AppConfig;
  /** Vuelve a pedir la config a la API (usar tras guardar en Ajustes). */
  refreshConfig: () => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({
  initialConfig,
  children,
}: {
  initialConfig: AppConfig;
  children: React.ReactNode;
}) {
  const { data, mutate } = useSWR<{ config: AppConfig }>("/api/config", fetcher, {
    fallbackData: { config: initialConfig },
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });

  const config = data?.config ?? initialConfig;

  return (
    <ConfigContext.Provider value={{ config, refreshConfig: () => { mutate(); } }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): AppConfig {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig debe usarse dentro de <ConfigProvider>");
  return ctx.config;
}

export function useRefreshConfig(): () => void {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useRefreshConfig debe usarse dentro de <ConfigProvider>");
  return ctx.refreshConfig;
}
