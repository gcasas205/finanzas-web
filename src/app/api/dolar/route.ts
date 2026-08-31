import { NextRequest, NextResponse } from "next/server";
import { listDolarOps, addDolarOp, updateDolarOp, deleteDolarOp } from "@/lib/sheets";
import { generateId } from "@/lib/utils";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import type { DolarOperacion } from "@/types";

const CACHE_KEY = "dolar-ops";
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

export async function GET() {
  const operaciones = await cacheOrFetch(
    CACHE_KEY,
    () => listDolarOps(),
    CACHE_TTL,
  );
  return NextResponse.json({ operaciones });
}

function normalize(body: any): DolarOperacion {
  const montoUSD = Number(body.montoUSD) || 0;
  const precioARS = Number(body.precioARS) || 0;
  return {
    id: body.id || generateId(),
    fecha: body.fecha,
    tipo: body.tipo === "venta" ? "venta" : "compra",
    montoUSD,
    precioARS,
    // El total siempre se deriva en el server: fuente de verdad única
    totalARS: Math.round(montoUSD * precioARS * 100) / 100,
    notas: body.notas || "",
    createdAt: body.createdAt || new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.fecha || !body.montoUSD || !body.precioARS) {
    return NextResponse.json(
      { ok: false, error: "Faltan fecha, montoUSD o precioARS" },
      { status: 400 },
    );
  }

  const op = normalize(body);
  const ok = await addDolarOp(op);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok, operacion: op });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });
  }
  const op = normalize(body);
  const ok = await updateDolarOp(op);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const ok = await deleteDolarOp(id);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok });
}
