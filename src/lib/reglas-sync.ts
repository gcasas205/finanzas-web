import type { Transaction } from "@/types";
import { listReglas, saveReglas } from "@/lib/sheets";
import { aprenderReglas } from "@/lib/reglas";
import { cacheInvalidate } from "@/lib/cache";

export const CATEGORIAS_CACHE_KEY = "categorias";

/**
 * Guarda las reglas que surgen de las categorías elegidas. Es secundario: si
 * falla, se registra y no se corta el alta/edición que ya se guardó.
 */
export async function aprenderDe(txs: Array<Pick<Transaction, "descripcion" | "categoria" | "subcategoria">>): Promise<void> {
  if (!txs.length) return;
  try {
    const nuevas = aprenderReglas(await listReglas(), txs);
    if (nuevas) {
      await saveReglas(nuevas);
      cacheInvalidate(CATEGORIAS_CACHE_KEY);
    }
  } catch (e) {
    console.error("[reglas] no se pudieron aprender reglas:", e);
  }
}
