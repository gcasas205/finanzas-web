import { NextResponse } from "next/server";
import {
  listTransactions, addTransaction, addTransactionsBulk, updateTransaction, updateTransactionsBulk,
  deleteTransaction, deleteTransactionsBulk, loadConfig,
} from "@/lib/sheets";
import { buildTransaction } from "@/lib/transactions";
import { expandirCuotas } from "@/lib/cuotas";
import { sincronizarSueldos, borrarSueldosDe } from "@/lib/sueldos-sync";
import { aprenderDe } from "@/lib/reglas-sync";
import { generateId } from "@/lib/utils";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import { TransactionSchema, DeleteTransactionSchema, RecategorizarSchema } from "@/lib/validations";
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
  const config = await loadConfig();
  const tx = buildTransaction(body, config);
  // Compra en cuotas con tarjeta: se crean también las cuotas que faltan
  const txs = tx.fuente === "tarjeta" && body.crearCuotas !== false
    ? expandirCuotas(tx, generateId(), generateId)
    : [tx];
  if (txs.length > 1) await addTransactionsBulk(txs); else await addTransaction(tx);
  cacheInvalidate(CACHE_KEY);
  await sincronizarSueldos([txs[0]], config.salaryPaymentOffsetMonths, body.recibo);
  await aprenderDe([tx]);
  return NextResponse.json({ ok: true, transaction: txs[0], creados: txs.length }, { status: 201 });
});

export const PUT = withErrors(async (req) => {
  const body = await readJson(req, TransactionSchema);
  if (!body.id) throw new AppError(400, "validation", "Falta el id del movimiento a modificar", "id");
  const config = await loadConfig();
  const tx = buildTransaction(body, config);

  // Cuotas siguientes del mismo grupo: copian descripción, categoría, monto y notas
  let siguientes: typeof tx[] = [];
  if (body.aplicarAGrupo && tx.grupoCuotas) {
    siguientes = (await listTransactions())
      .filter((t) => t.grupoCuotas === tx.grupoCuotas && t.cuotaNumero > tx.cuotaNumero)
      .map((t) => ({
        ...t,
        descripcion: tx.descripcion,
        categoria: tx.categoria,
        subcategoria: tx.subcategoria,
        monto: tx.monto,
        notas: tx.notas.replace(/Cuota \d+\/\d+/, `Cuota ${t.cuotaNumero}/${t.cuotaTotal}`),
      }));
  }

  if (siguientes.length) {
    const faltan = await updateTransactionsBulk([tx, ...siguientes]);
    if (faltan.includes(tx.id)) throw new NotFoundError("Movimiento");
  } else {
    const found = await updateTransaction(tx);
    if (!found) throw new NotFoundError("Movimiento");
  }
  cacheInvalidate(CACHE_KEY);
  await sincronizarSueldos([tx], config.salaryPaymentOffsetMonths, body.recibo);
  await aprenderDe([tx]);
  return NextResponse.json({ ok: true, transaction: tx, actualizados: 1 + siguientes.length });
});

/** Recategoriza varios movimientos. Lee la planilla fresca (no la caché) para no pisar cambios. */
export const PATCH = withErrors(async (req) => {
  const { ids, categoria, subcategoria } = await readJson(req, RecategorizarSchema);
  const pedidos = new Set(ids);
  const txs = (await listTransactions()).filter((t) => pedidos.has(t.id));
  if (txs.length !== pedidos.size) throw new NotFoundError("Movimiento");
  const cambiados = txs.map((t) => ({ ...t, categoria, subcategoria }));
  await updateTransactionsBulk(cambiados);
  cacheInvalidate(CACHE_KEY);
  await sincronizarSueldos(cambiados, (await loadConfig()).salaryPaymentOffsetMonths);
  await aprenderDe(cambiados);
  return NextResponse.json({ ok: true, updated: txs.length });
});

export const DELETE = withErrors(async (req) => {
  const { id, grupo } = await readJson(req, DeleteTransactionSchema);
  let borrados: string[] = [id];
  if (grupo) {
    const todos = await listTransactions();
    const tx = todos.find((t) => t.id === id);
    if (!tx) throw new NotFoundError("Movimiento");
    if (tx.grupoCuotas) {
      borrados = todos
        .filter((t) => t.grupoCuotas === tx.grupoCuotas && t.cuotaNumero >= tx.cuotaNumero)
        .map((t) => t.id);
    }
  }
  if (borrados.length > 1) {
    await deleteTransactionsBulk(borrados);
  } else {
    const found = await deleteTransaction(id);
    if (!found) throw new NotFoundError("Movimiento");
  }
  cacheInvalidate(CACHE_KEY);
  await borrarSueldosDe(borrados);
  return NextResponse.json({ ok: true, borrados: borrados.length });
});
