import { NextResponse } from "next/server";
import { listTransactions, addTransaction, updateTransaction, updateTransactionsBulk, deleteTransaction, loadConfig } from "@/lib/sheets";
import { buildTransaction } from "@/lib/transactions";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import { TransactionSchema, IdSchema, RecategorizarSchema } from "@/lib/validations";
import { AppError, NotFoundError, readJson, withErrors } from "@/lib/errors";

// Siempre dinámica: los datos viven en Sheets, nunca se generan en el build.
export const dynamic = "force-dynamic";

const CACHE_KEY = "transactions";
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

export const GET = withErrors(async () => {
  const transactions = await cacheOrFetch(CACHE_KEY, () => listTransactions(), CACHE_TTL);
  return NextResponse.json({ transactions });
});

export const POST = withErrors(async (req) => {
  const body = await readJson(req, TransactionSchema);
  const tx = buildTransaction(body, await loadConfig());
  await addTransaction(tx);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true, transaction: tx }, { status: 201 });
});

export const PUT = withErrors(async (req) => {
  const body = await readJson(req, TransactionSchema);
  if (!body.id) throw new AppError(400, "validation", "Falta el id del movimiento a modificar", "id");
  const tx = buildTransaction(body, await loadConfig());
  const found = await updateTransaction(tx);
  if (!found) throw new NotFoundError("Movimiento");
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true, transaction: tx });
});

/** Recategoriza varios movimientos. Lee la planilla fresca (no la caché) para no pisar cambios. */
export const PATCH = withErrors(async (req) => {
  const { ids, categoria, subcategoria } = await readJson(req, RecategorizarSchema);
  const pedidos = new Set(ids);
  const txs = (await listTransactions()).filter((t) => pedidos.has(t.id));
  if (txs.length !== pedidos.size) throw new NotFoundError("Movimiento");
  await updateTransactionsBulk(txs.map((t) => ({ ...t, categoria, subcategoria })));
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true, updated: txs.length });
});

export const DELETE = withErrors(async (req) => {
  const { id } = await readJson(req, IdSchema);
  const found = await deleteTransaction(id);
  if (!found) throw new NotFoundError("Movimiento");
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true });
});
