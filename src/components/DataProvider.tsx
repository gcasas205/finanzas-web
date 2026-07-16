"use client";

import { createContext, useContext, useCallback } from "react";
import useSWR from "swr";
import type { Transaction, AppConfig } from "@/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface DataContextType {
  transactions: Transaction[];
  isLoading: boolean;
  error: any;
  /** Call after any mutation (add/edit/delete/import) to refresh data */
  refresh: () => void;
}

const DataContext = createContext<DataContextType>({
  transactions: [],
  isLoading: true,
  error: null,
  refresh: () => {},
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/transactions",
    fetcher,
    {
      revalidateOnFocus: false,      // Don't refetch on tab focus
      revalidateOnReconnect: false,  // Don't refetch on reconnect
      dedupingInterval: 60_000,      // Dedup requests within 60s
      refreshInterval: 0,            // No automatic refresh
      keepPreviousData: true,        // Show stale data while revalidating
    }
  );

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return (
    <DataContext.Provider
      value={{
        transactions: data?.transactions ?? [],
        isLoading,
        error,
        refresh,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

/** Hook to access shared transaction data */
export function useTransactions() {
  return useContext(DataContext);
}
