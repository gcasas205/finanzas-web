"use client";

import { createContext, useContext, useCallback } from "react";
import useSWR from "swr";
import type { Transaction, DolarOperacion, Cotizacion, AhorroConfig, MovAhorro } from "@/types";
import { request, dolarApi, errorMessage } from "@/lib/api";

// El fetcher tira ApiError si la respuesta no es ok: un 500/503 nunca se toma
// como "sin datos" (antes `r.json()` del error terminaba en una lista vacía).
const fetcher = <T,>(url: string) => request<T>(url);

interface DataContextType {
  transactions: Transaction[];
  dolarOps: DolarOperacion[];
  cotizacion: Cotizacion | null;
  ahorroConfig: AhorroConfig | null;
  /** Pases entre destinos del ahorro */
  movAhorro: MovAhorro[];
  isLoading: boolean;
  /** Mensaje del error de carga de movimientos u operaciones, o null. */
  error: string | null;
  /** Error de la config de ahorro (sólo la usa la vista Ahorro). */
  ahorroError: string | null;
  /** Refresca transacciones y operaciones de dólar tras cualquier mutación */
  refresh: () => void;
  /** Vuelve a pedir la cotización (opcionalmente forzando el scraping) */
  refreshCotizacion: (force?: boolean) => void;
}

const DataContext = createContext<DataContextType>({
  transactions: [],
  dolarOps: [],
  cotizacion: null,
  ahorroConfig: null,
  movAhorro: [],
  isLoading: true,
  error: null,
  ahorroError: null,
  refresh: () => {},
  refreshCotizacion: () => {},
});

const SWR_OPTS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60_000,
  refreshInterval: 0,
  keepPreviousData: true,
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const tx = useSWR<{ transactions: Transaction[] }>("/api/transactions", fetcher, SWR_OPTS);
  const dolar = useSWR<{ operaciones: DolarOperacion[] }>("/api/dolar", fetcher, SWR_OPTS);
  const cot = useSWR<Cotizacion>("/api/dolar/cotizacion", fetcher, {
    ...SWR_OPTS,
    // La cotización cambia durante el día: refrescar cada 15 min
    refreshInterval: 15 * 60 * 1000,
  });
  const ahorro = useSWR<{ config: AhorroConfig }>("/api/ahorro/config", fetcher, SWR_OPTS);
  const mov = useSWR<{ movimientos: MovAhorro[] }>("/api/ahorro/movimientos", fetcher, SWR_OPTS);

  const refresh = useCallback(() => {
    tx.mutate();
    dolar.mutate();
    ahorro.mutate();
    mov.mutate();
  }, [tx, dolar, ahorro, mov]);

  const refreshCotizacion = useCallback((force = false) => {
    if (force) {
      // Pide al server que re-scrapee, ignorando su caché de 10 min
      dolarApi
        .cotizacion(true)
        .then(data => cot.mutate(data, { revalidate: false }))
        .catch(() => { /* el banner ya muestra "sin cotización"; no es bloqueante */ });
    } else {
      cot.mutate();
    }
  }, [cot]);

  return (
    <DataContext.Provider
      value={{
        transactions: tx.data?.transactions ?? [],
        dolarOps: dolar.data?.operaciones ?? [],
        cotizacion: cot.data ?? null,
        ahorroConfig: ahorro.data?.config ?? null,
        movAhorro: mov.data?.movimientos ?? [],
        isLoading: tx.isLoading || dolar.isLoading,
        error: tx.error || dolar.error ? errorMessage(tx.error || dolar.error) : null,
        ahorroError: ahorro.error || mov.error ? errorMessage(ahorro.error || mov.error) : null,
        refresh,
        refreshCotizacion,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

/** Hook para acceder a los datos compartidos */
export function useTransactions() {
  return useContext(DataContext);
}

/** Alias semántico para las operaciones de dólar */
export function useDolar() {
  const { dolarOps, cotizacion, isLoading, error, refresh, refreshCotizacion } = useContext(DataContext);
  return { dolarOps, cotizacion, isLoading, error, refresh, refreshCotizacion };
}

/** Datos necesarios para la vista de Ahorro */
export function useAhorro() {
  const { dolarOps, transactions, ahorroConfig, movAhorro, isLoading, error, ahorroError, refresh } = useContext(DataContext);
  return { dolarOps, transactions, ahorroConfig, movAhorro, isLoading, error: error ?? ahorroError, refresh };
}
