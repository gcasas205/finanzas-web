import type { Transaction } from "@/types";

/** Suma meses a "AAAA-MM-DD" conservando el día (si no existe, el último del mes). */
export function sumarMeses(fecha: string, n: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const ultimo = new Date(y, m - 1 + n + 1, 0).getDate();
  const f = new Date(y, m - 1 + n, Math.min(d, ultimo));
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

/**
 * Compra en cuotas: a partir de la cuota cargada (ej. 3/12) arma también las que
 * faltan (4..12), una por mes, con la misma fecha de consumo y monto, y un grupo
 * en común para poder editarlas o borrarlas juntas. La primera es `tx` misma.
 */
export function expandirCuotas(tx: Transaction, grupo: string, nuevoId: () => string): Transaction[] {
  if (tx.cuotaTotal <= 1 || tx.cuotaNumero >= tx.cuotaTotal) return [tx];
  const out: Transaction[] = [{ ...tx, grupoCuotas: grupo }];
  for (let k = tx.cuotaNumero + 1; k <= tx.cuotaTotal; k++) {
    const desplazamiento = k - tx.cuotaNumero;
    out.push({
      ...tx,
      id: nuevoId(),
      cuotaNumero: k,
      fechaPago: sumarMeses(tx.fechaPago, desplazamiento),
      notas: tx.notas.replace(/Cuota \d+\/\d+/, `Cuota ${k}/${tx.cuotaTotal}`),
      grupoCuotas: grupo,
    });
  }
  return out;
}
