import type { ReglaCategoria, Transaction } from "@/types";
import { autoCategorizar, claveComercio } from "@/lib/categories";

/** Máximo de reglas guardadas: las más nuevas primero. */
const MAX_REGLAS = 500;

/**
 * Aprende de las categorías que elegiste: si un movimiento quedó en una categoría
 * distinta de la que se hubiera sugerido, guarda (o corrige) la regla de ese
 * comercio. Devuelve null si no hay nada nuevo que guardar.
 */
export function aprenderReglas(
  reglas: ReglaCategoria[],
  txs: Array<Pick<Transaction, "descripcion" | "categoria" | "subcategoria">>,
): ReglaCategoria[] | null {
  let lista = [...reglas];
  let cambio = false;
  for (const t of txs) {
    const palabra = claveComercio(t.descripcion);
    if (palabra.length < 3) continue;
    const sugerida = autoCategorizar(t.descripcion, lista);
    if (sugerida.categoria === t.categoria && sugerida.subcategoria === t.subcategoria) continue;
    lista = [
      { palabra, categoria: t.categoria, subcategoria: t.subcategoria },
      ...lista.filter((r) => r.palabra !== palabra),
    ];
    cambio = true;
  }
  return cambio ? lista.slice(0, MAX_REGLAS) : null;
}

/** Al renombrar categorías, las reglas apuntan al nombre nuevo. */
export function renombrarEnReglas(reglas: ReglaCategoria[], renombres: Record<string, string>): ReglaCategoria[] {
  return reglas.map((r) => (renombres[r.categoria] ? { ...r, categoria: renombres[r.categoria] } : r));
}
