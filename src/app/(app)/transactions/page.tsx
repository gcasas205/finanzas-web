"use client";

import Transactions from "@/components/views/Transactions";
import { useConfig } from "@/components/ConfigProvider";

export default function TransactionsPage() {
  return <Transactions config={useConfig()} />;
}