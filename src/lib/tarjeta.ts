import type { Transaction } from "@/types";

export interface ResumenTarjeta {
  /** Fecha de vencimiento "AAAA-MM-DD" */
  vence: string;
  /** Neto a pagar en pesos (consumos − créditos) */
  pesos: number;
  /** Neto a pagar en dólares */
  dolares: number;
  /** Cantidad de movimientos que lo componen */
  items: number;
  /** De esos, cuántos son cuotas */
  cuotas: number;
}

/**
 * Próximo resumen de tarjeta a pagar: los movimientos de tarjeta con la fecha de
 * pago más cercana desde hoy (incluido). null si no hay nada por vencer.
 */
export function proximoResumen(txs: Transaction[], hoy: string): ResumenTarjeta | null {
  const tarjeta = txs.filter((t) => t.fuente === "tarjeta" && t.fechaPago >= hoy);
  if (!tarjeta.length) return null;
  const vence = tarjeta.reduce((min, t) => (t.fechaPago < min ? t.fechaPago : min), tarjeta[0].fechaPago);
  const del = tarjeta.filter((t) => t.fechaPago === vence);
  const neto = (moneda: "ARS" | "USD") =>
    del.filter((t) => (t.moneda || "ARS") === moneda).reduce((s, t) => s + (t.tipo === "ingreso" ? -t.monto : t.monto), 0);
  return {
    vence,
    pesos: neto("ARS"),
    dolares: neto("USD"),
    items: del.length,
    cuotas: del.filter((t) => t.cuotaTotal > 1).length,
  };
}
