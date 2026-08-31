"use client";

import { createContext, useContext, useCallback } from "react";
import useSWR from "swr";
import type { Transaction, DolarOperacion, Cotizacion } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface DataContextType {
  transactions: Transaction[];
  dolarOps: DolarOperacion[];
  cotizacion: Cotizacion | null;
  isLoading: boolean;
  error: any;
  /** Refresca transacciones y operaciones de dólar tras cualquier mutación */
  refresh: () => void;
  /** Vuelve a pedir la cotización (opcionalmente forzando el scraping) */
  refreshCotizacion: (force?: boolean) => void;
}

const DataContext = createContext<DataContextType>({
  transactions: [],
  dolarOps: [],
  cotizacion: null,
  isLoading: true,
  error: null,
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
  const tx = useSWR("/api/transactions", fetcher, SWR_OPTS);
  const dolar = useSWR("/api/dolar", fetcher, SWR_OPTS);
  const cot = useSWR("/api/dolar/cotizacion", fetcher, {
    ...SWR_OPTS,
    // La cotización cambia durante el día: refrescar cada 15 min
    refreshInterval: 15 * 60 * 1000,
  });

  const refresh = useCallback(() => {
    tx.mutate();
    dolar.mutate();
  }, [tx, dolar]);

  const refreshCotizacion = useCallback((force = false) => {
    if (force) {
      // Pide al server que re-scrapee, ignorando su caché de 10 min
      fetch("/api/dolar/cotizacion?force=1")
        .then(r => r.json())
        .then(data => cot.mutate(data, { revalidate: false }));
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
        isLoading: tx.isLoading,
        error: tx.error || dolar.error,
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
  const { dolarOps, cotizacion, isLoading, refresh, refreshCotizacion } = useContext(DataContext);
  return { dolarOps, cotizacion, isLoading, refresh, refreshCotizacion };
}
