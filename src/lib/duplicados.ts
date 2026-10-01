import { roundMoney } from "@/lib/utils";
import type { Transaction } from "@/types";

type Comparable = Pick<Transaction, "fechaConsumo" | "monto" | "descripcion" | "cuotaNumero"> &
  Partial<Pick<Transaction, "cuotaTotal">>;

// Una cuota se reconoce por fecha de compra, monto y "n/total" aunque la descripción
// difiera (ej. cargada a mano y después importada del resumen).
const clave = (t: Comparable) =>
  (t.cuotaTotal ?? 1) > 1
    ? ["cuota", t.fechaConsumo, roundMoney(t.monto), t.cuotaNumero, t.cuotaTotal].join("|")
    : [t.fechaConsumo, roundMoney(t.monto), t.cuotaNumero || 1, t.descripcion.trim().toLowerCase().replace(/\s+/g, " ")].join("|");

/**
 * Separa los movimientos a importar en nuevos y ya cargados, comparando fecha de
 * consumo, monto, número de cuota y descripción. Respeta repeticiones: si en la
 * planilla hay un café y el resumen trae dos iguales, sólo uno cuenta como duplicado.
 */
export function separarDuplicados<T extends Comparable>(
  nuevos: T[],
  existentes: Comparable[],
): { nuevos: T[]; duplicados: T[] } {
  const disponibles = new Map<string, number>();
  for (const t of existentes) {
    const k = clave(t);
    disponibles.set(k, (disponibles.get(k) ?? 0) + 1);
  }
  const out: { nuevos: T[]; duplicados: T[] } = { nuevos: [], duplicados: [] };
  for (const t of nuevos) {
    const k = clave(t);
    const n = disponibles.get(k) ?? 0;
    if (n > 0) {
      disponibles.set(k, n - 1);
      out.duplicados.push(t);
    } else {
      out.nuevos.push(t);
    }
  }
  return out;
}
