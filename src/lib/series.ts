import type { Transaction } from "@/types";
import { fechaToMes } from "@/lib/utils";

export interface MesSerie {
  /** "AAAA-MM" */
  mes: string;
  ingresos: number;
  egresos: number;
  ahorro: number;
  /** Ahorro acumulado desde el primer mes con datos (no desde el inicio de la ventana) */
  acumulado: number;
}

/** "AAAA-MM" siguiente. */
function siguiente(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Serie mensual de ingresos/gastos por mes de pago, desde el primer mes con
 * datos hasta `hasta` (incluido), sin huecos: los meses sin movimientos van en 0.
 * Los meses posteriores a `hasta` (cuotas o resúmenes por pagar) quedan afuera.
 */
export function serieMensual(
  txs: Array<Pick<Transaction, "fechaPago" | "tipo" | "monto">>,
  hasta: string,
): MesSerie[] {
  const map = new Map<string, { ingresos: number; egresos: number }>();
  for (const t of txs) {
    const mes = fechaToMes(t.fechaPago);
    if (!mes || mes > hasta) continue;
    const cur = map.get(mes) ?? { ingresos: 0, egresos: 0 };
    if (t.tipo === "ingreso") cur.ingresos += t.monto; else cur.egresos += t.monto;
    map.set(mes, cur);
  }
  if (!map.size) return [];
  const out: MesSerie[] = [];
  let acum = 0;
  for (let mes = Array.from(map.keys()).sort()[0]; mes <= hasta; mes = siguiente(mes)) {
    const v = map.get(mes) ?? { ingresos: 0, egresos: 0 };
    const ahorro = v.ingresos - v.egresos;
    acum += ahorro;
    out.push({ mes, ...v, ahorro, acumulado: acum });
  }
  return out;
}

/** Últimos `n` meses de una serie ordenada. */
export function ultimosMeses<T>(serie: T[], n: number): T[] {
  return serie.slice(-n);
}
