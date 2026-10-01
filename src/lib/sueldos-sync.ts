import type { Transaction } from "@/types";
import { listSueldos, addSueldo, updateSueldo, deleteSueldo } from "@/lib/sheets";
import { esSueldo, sueldoDesdeMovimiento, type DatosRecibo } from "@/lib/sueldos";
import { cacheInvalidate } from "@/lib/cache";

export const SUELDOS_CACHE_KEY = "sueldos";

/**
 * Mantiene la hoja Sueldos al día con los movimientos: si un movimiento es sueldo,
 * crea o actualiza su fila (vinculada por txId); si dejó de serlo, la borra.
 */
export async function sincronizarSueldos(
  txs: Transaction[],
  offsetMeses: number,
  recibo?: DatosRecibo,
): Promise<void> {
  if (!txs.length) return;
  const sueldos = await listSueldos();
  let cambios = false;
  for (const tx of txs) {
    const vinculado = sueldos.find((s) => s.txId === tx.id);
    if (esSueldo(tx)) {
      const fila = sueldoDesdeMovimiento(tx, offsetMeses, recibo, vinculado);
      if (vinculado) await updateSueldo(fila); else await addSueldo(fila);
      cambios = true;
    } else if (vinculado) {
      await deleteSueldo(vinculado.id);
      cambios = true;
    }
  }
  if (cambios) cacheInvalidate(SUELDOS_CACHE_KEY);
}

/** Borra las filas de Sueldos vinculadas a movimientos que se eliminaron. */
export async function borrarSueldosDe(txIds: string[]): Promise<void> {
  if (!txIds.length) return;
  const ids = new Set(txIds);
  const vinculados = (await listSueldos()).filter((s) => s.txId && ids.has(s.txId));
  for (const s of vinculados) await deleteSueldo(s.id);
  if (vinculados.length) cacheInvalidate(SUELDOS_CACHE_KEY);
}
