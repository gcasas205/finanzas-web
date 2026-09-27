import { NextResponse } from "next/server";
import { listDolarOps, addDolarOp, updateDolarOp, deleteDolarOp } from "@/lib/sheets";
import { generateId, roundMoney } from "@/lib/utils";
import { cacheOrFetch, cacheInvalidate } from "@/lib/cache";
import { DolarOpSchema, IdSchema, type DolarOpInput } from "@/lib/validations";
import { AppError, NotFoundError, readJson, withErrors } from "@/lib/errors";
import type { DolarOperacion } from "@/types";

export const dynamic = "force-dynamic";

const CACHE_KEY = "dolar-ops";
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

function buildDolarOp(body: DolarOpInput): DolarOperacion {
  const esVenta = body.tipo === "venta";
  return {
    id: body.id || generateId(),
    fecha: body.fecha,
    tipo: body.tipo,
    montoUSD: body.montoUSD,
    precioARS: body.precioARS,
    // El total siempre se deriva en el server: fuente de verdad única
    totalARS: roundMoney(body.montoUSD * body.precioARS),
    notas: body.notas || "",
    createdAt: body.createdAt || new Date().toISOString(),
    // Compra: reparto del ahorro. Venta: origen del retiro.
    asigMediano: esVenta ? undefined : body.asigMediano || 0,
    asigLargo: esVenta ? undefined : body.asigLargo || 0,
    origen: esVenta ? body.origen || "regla" : undefined,
  };
}

export const GET = withErrors(async () => {
  const operaciones = await cacheOrFetch(CACHE_KEY, () => listDolarOps(), CACHE_TTL);
  return NextResponse.json({ operaciones });
});

export const POST = withErrors(async (req) => {
  const op = buildDolarOp(await readJson(req, DolarOpSchema));
  await addDolarOp(op);
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true, operacion: op }, { status: 201 });
});

export const PUT = withErrors(async (req) => {
  const body = await readJson(req, DolarOpSchema);
  if (!body.id) throw new AppError(400, "validation", "Falta el id de la operación a modificar", "id");
  const op = buildDolarOp(body);
  if (!(await updateDolarOp(op))) throw new NotFoundError("Operación");
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true, operacion: op });
});

export const DELETE = withErrors(async (req) => {
  const { id } = await readJson(req, IdSchema);
  if (!(await deleteDolarOp(id))) throw new NotFoundError("Operación");
  cacheInvalidate(CACHE_KEY);
  return NextResponse.json({ ok: true });
});
