import { NextRequest, NextResponse } from "next/server";
import { getCotizacionOficial } from "@/lib/dolar";
import type { Cotizacion } from "@/types";

// Valor de respaldo por si dolarhoy está caído la primera vez (sin caché previa).
// El usuario siempre puede sobreescribir el precio a mano al cargar la operación.
const FALLBACK: Cotizacion = {
  compra: 0,
  venta: 0,
  actualizado: null,
  fetchedAt: new Date(0).toISOString(),
  fallback: true,
};

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    const cot = await getCotizacionOficial(force);
    return NextResponse.json(cot);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
