import type { Transaction } from "@/types";
import { fechaToMes } from "@/lib/utils";
import { claveComercio } from "@/lib/categories";

export interface GastoRecurrente {
  /** Nombre representativo (la descripción más reciente del grupo) */
  nombre: string;
  categoria: string;
  /** Veces que apareció en el período analizado */
  veces: number;
  /** Meses distintos en los que apareció */
  meses: number;
  /** Gasto promedio por mes en el período */
  porMes: number;
  /** Proyección anual (porMes × 12) */
  porAnio: number;
  /** Monto promedio de cada consumo */
  promedio: number;
}

/** Agrupa descripciones parecidas: sin números ni signos, primeras 3 palabras. */
export { claveComercio } from "@/lib/categories";

/** Meses "AAAA-MM" de la ventana que termina en `hasta` (incluido). */
function ventana(hasta: string, n: number): string[] {
  const [y, m] = hasta.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

function agrupar(txs: Transaction[]) {
  const grupos = new Map<string, Transaction[]>();
  for (const t of txs) {
    const k = claveComercio(t.descripcion);
    if (!k) continue;
    const g = grupos.get(k);
    if (g) g.push(t); else grupos.set(k, [t]);
  }
  return grupos;
}

function resumir(g: Transaction[], mesesVentana: number): GastoRecurrente {
  const total = g.reduce((s, t) => s + t.monto, 0);
  const ultimo = [...g].sort((a, b) => b.fechaPago.localeCompare(a.fechaPago))[0];
  const porMes = total / mesesVentana;
  return {
    nombre: ultimo.descripcion,
    categoria: ultimo.categoria,
    veces: g.length,
    meses: new Set(g.map((t) => fechaToMes(t.fechaPago))).size,
    porMes,
    porAnio: porMes * 12,
    promedio: total / g.length,
  };
}

/**
 * Suscripciones: el mismo comercio en al menos 3 de los últimos 6 meses, una vez
 * por mes y con montos parecidos (el mayor no supera el doble del menor, para
 * tolerar aumentos). Sólo gastos en pesos.
 */
export function detectarSuscripciones(txs: Transaction[], hasta: string): GastoRecurrente[] {
  const meses = new Set(ventana(hasta, 6));
  const gastos = txs.filter((t) => t.tipo === "egreso" && t.moneda !== "USD" && meses.has(fechaToMes(t.fechaPago)));
  return Array.from(agrupar(gastos).values())
    .filter((g) => {
      const porMes = new Set(g.map((t) => fechaToMes(t.fechaPago))).size;
      const montos = g.map((t) => t.monto);
      return porMes >= 3 && g.length <= porMes + 1 && Math.max(...montos) <= Math.min(...montos) * 2;
    })
    .map((g) => resumir(g, 6))
    .sort((a, b) => b.porAnio - a.porAnio);
}

/**
 * Gastos hormiga: consumos chicos y frecuentes. En los últimos 3 meses, comercios
 * con 6 o más consumos cuyo monto promedio está en el cuarto más barato de todos
 * los gastos del período. Sólo gastos en pesos, sin cuotas.
 */
export function detectarHormiga(txs: Transaction[], hasta: string): GastoRecurrente[] {
  const meses = new Set(ventana(hasta, 3));
  const gastos = txs.filter(
    (t) => t.tipo === "egreso" && t.moneda !== "USD" && t.cuotaTotal <= 1 && meses.has(fechaToMes(t.fechaPago)),
  );
  if (gastos.length < 6) return [];
  const ordenados = gastos.map((t) => t.monto).sort((a, b) => a - b);
  const p25 = ordenados[Math.floor(ordenados.length * 0.25)];
  return Array.from(agrupar(gastos).values())
    .filter((g) => g.length >= 6 && g.reduce((s, t) => s + t.monto, 0) / g.length <= p25)
    .map((g) => resumir(g, 3))
    .sort((a, b) => b.porAnio - a.porAnio);
}
