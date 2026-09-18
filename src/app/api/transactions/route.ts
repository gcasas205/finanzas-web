import { NextRequest, NextResponse } from "next/server";
import { listTransactions, addTransaction, updateTransaction, deleteTransaction } from "@/lib/sheets";
import { generateId, calcularFechaPagoTarjeta } from "@/lib/utils";
import { loadConfig } from "@/lib/sheets";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import type { Transaction } from "@/types";
import { TransactionSchema } from "@/lib/validations";

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
  try {
    const rawBody = await req.json();
    const parseResult = TransactionSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const body = parseResult.data;
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
      fechaPago: fechaPago as string,
      tipo: body.tipo,
      descripcion: body.descripcion,
      monto: body.monto,
      moneda: body.moneda,
      categoria: body.categoria,
      subcategoria: body.subcategoria,
      fuente: body.fuente,
      cuotaTotal: body.cuotaTotal,
      cuotaNumero: body.cuotaNumero,
      notas: body.notas || "",
      createdAt: body.createdAt || new Date().toISOString(),
      origen: body.moneda === "USD" && body.tipo === "egreso" ? (body.origen || "regla") : undefined,
      asigMediano: body.moneda === "USD" && body.tipo === "ingreso" ? body.asigMediano || 0 : undefined,
      asigLargo: body.moneda === "USD" && body.tipo === "ingreso" ? body.asigLargo || 0 : undefined,
    };

    const ok = await addTransaction(tx);
    if (!ok) throw new Error("No se pudo agregar a Google Sheets");
    
    cacheInvalidate(CACHE_KEY); // Forzar refresh en próximo GET
    return NextResponse.json({ success: true, ok: true, transaction: tx });
  } catch (error: any) {
    return NextResponse.json({ success: false, ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = TransactionSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, ok: false, error: "Datos inválidos", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    // El PUT actual espera que el objeto se envíe tal cual
    const tx = rawBody as Transaction;
    const ok = await updateTransaction(tx);
    if (!ok) throw new Error("No se pudo actualizar en Google Sheets");
    
    cacheInvalidate(CACHE_KEY);
    return NextResponse.json({ success: true, ok: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const ok = await deleteTransaction(id);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok });
}