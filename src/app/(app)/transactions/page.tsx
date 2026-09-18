import { loadConfig } from "@/lib/sheets";
import Transactions from "@/components/views/Transactions";

export default async function TransactionsPage() {
  const config = await loadConfig();
  return <Transactions config={config} />;
}