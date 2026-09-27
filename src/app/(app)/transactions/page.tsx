"use client";

import { Suspense } from "react";
import Transactions from "@/components/views/Transactions";
import { useConfig } from "@/components/ConfigProvider";

export default function TransactionsPage() {
  const config = useConfig();
  // Suspense: Transactions lee ?nuevo=1 con useSearchParams.
  return (
    <Suspense>
      <Transactions config={config} />
    </Suspense>
  );
}