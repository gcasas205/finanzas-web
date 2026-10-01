import type { Sueldo, Transaction } from "@/types";
import { fechaToMes, generateId } from "@/lib/utils";

/** Datos del recibo que se pueden cargar a mano junto con el ingreso. */
export interface DatosRecibo {
  empresa?: string;
  cargo?: string;
  /** "AAAA-MM" */
  periodoTrabajado?: string;
  bruto?: number;
  jubilacion?: number;
  obraSocial?: number;
  ley19032?: number;
  otrosDescuentos?: number;
}

/** Un movimiento es sueldo si es un ingreso en pesos de Ingresos → Sueldo. */
export function esSueldo(t: Pick<Transaction, "tipo" | "categoria" | "subcategoria" | "moneda">): boolean {
  return t.tipo === "ingreso" && t.categoria === "Ingresos" && t.subcategoria === "Sueldo" && (t.moneda || "ARS") === "ARS";
}

/** "AAAA-MM" desplazado n meses hacia atrás. */
function mesAnterior(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Arma la fila de la hoja Sueldos a partir del movimiento. El neto, la fecha y el
 * período de pago salen siempre del movimiento; el resto, de los datos del recibo
 * si vinieron, o de la fila que ya existía (al editar sin tocar esos datos).
 * Sin período trabajado, se asume el mes de pago menos el desfase de Ajustes.
 */
export function sueldoDesdeMovimiento(
  tx: Transaction,
  offsetMeses: number,
  datos?: DatosRecibo,
  existente?: Sueldo,
): Sueldo {
  const periodoPago = fechaToMes(tx.fechaPago);
  const d = datos ?? {};
  const e = existente;
  return {
    id: e?.id ?? generateId(),
    txId: tx.id,
    periodoTrabajado: d.periodoTrabajado || e?.periodoTrabajado || mesAnterior(periodoPago, offsetMeses),
    periodoPago,
    empresa: d.empresa ?? e?.empresa ?? "",
    cargo: d.cargo ?? e?.cargo ?? "",
    bruto: d.bruto ?? e?.bruto ?? 0,
    neto: tx.monto,
    jubilacion: d.jubilacion ?? e?.jubilacion ?? 0,
    obraSocial: d.obraSocial ?? e?.obraSocial ?? 0,
    ley19032: d.ley19032 ?? e?.ley19032 ?? 0,
    otrosDescuentos: d.otrosDescuentos ?? e?.otrosDescuentos ?? 0,
    fechaPago: tx.fechaPago,
    createdAt: e?.createdAt ?? new Date().toISOString(),
  };
}
