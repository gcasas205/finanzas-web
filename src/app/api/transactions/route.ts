import { NextRequest, NextResponse } from "next/server";
import { listTransactions, addTransaction, updateTransaction, deleteTransaction } from "@/lib/sheets";
import { generateId, calcularFechaPagoTarjeta } from "@/lib/utils";
import { loadConfig } from "@/lib/sheets";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import type { Transaction } from "@/types";

const CACHE_KEY = "transactions";
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

export async function GET() {
  const transactions = await cacheOrFetch(
    CACHE_KEY,
    () => listTransactions(),
    CACHE_TTL,
  );
  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = await loadConfig();

  let fechaPago = body.fechaPago;
  if (!fechaPago && body.fuente === "tarjeta") {
    fechaPago = calcularFechaPagoTarjeta(
      body.fechaConsumo,
      config.cardCutoffDay,
      config.cardDueDay,
    );
  }
  if (!fechaPago) fechaPago = body.fechaConsumo;

  const tx: Transaction = {
    id: body.id || generateId(),
    fechaConsumo: body.fechaConsumo,
    fechaPago,
    tipo: body.tipo,
    descripcion: body.descripcion,
    monto: Number(body.monto),
    moneda: body.moneda || "ARS",
    categoria: body.categoria || "Otros",
    subcategoria: body.subcategoria || "Sin categoría",
    fuente: body.fuente || "manual",
    cuotaTotal: Number(body.cuotaTotal) || 1,
    cuotaNumero: Number(body.cuotaNumero) || 1,
    notas: body.notas || "",
    createdAt: body.createdAt || new Date().toISOString(),
  };

  const ok = await addTransaction(tx);
  cacheInvalidate(CACHE_KEY); // Forzar refresh en próximo GET
  return NextResponse.json({ ok, transaction: tx });
}

export async function PUT(req: NextRequest) {
  const tx = await req.json() as Transaction;
  const ok = await updateTransaction(tx);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const ok = await deleteTransaction(id);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok });
}
