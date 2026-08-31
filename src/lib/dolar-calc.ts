import type { DolarOperacion, Transaction } from "@/types";

export interface DolarResumen {
  /** USD actualmente en cartera (compras − ventas − gastos en USD + ingresos en USD) */
  tenenciaUSD: number;
  /** Pesos totales invertidos netos (compras ARS − ventas ARS) */
  netoInvertidoARS: number;
  /** Precio promedio ponderado de compra (ARS/USD) de la tenencia actual */
  precioPromedioCompra: number;
  /** Total de USD comprados históricamente */
  totalCompradoUSD: number;
  /** Total de USD vendidos históricamente */
  totalVendidoUSD: number;
  /** Pesos gastados en compras */
  totalCompradoARS: number;
  /** Pesos recibidos por ventas */
  totalVendidoARS: number;
  /** Total de USD gastados directamente desde la tenencia (egresos en USD) */
  totalGastadoUSD: number;
}

/** Evento normalizado sobre la tenencia de dólares, ordenable por fecha */
interface Evento {
  fecha: string;
  tipo: "compra" | "venta" | "gastoUSD" | "ingresoUSD";
  usd: number;
  totalARS: number; // solo relevante para compra/venta
}

/**
 * Calcula la tenencia y el precio promedio de compra con costo promedio
 * ponderado. Recibe las operaciones de dólar (pestaña "Dolares") y, opcionalmente,
 * las transacciones en USD (pestaña "Transacciones" con moneda = USD):
 *   - egreso USD  → gasto pagado con dólares ahorrados: reduce la tenencia al costo promedio.
 *   - ingreso USD → dólares que entran (ej. cobro en USD): suma a la tenencia al costo promedio vigente.
 * Las ventas y gastos reducen la tenencia sin alterar el precio promedio de lo que queda.
 */
export function resumenDolar(ops: DolarOperacion[], usdTxs: Transaction[] = []): DolarResumen {
  const eventos: Evento[] = [];

  for (const op of ops) {
    eventos.push({
      fecha: op.fecha,
      tipo: op.tipo, // "compra" | "venta"
      usd: op.montoUSD,
      totalARS: op.totalARS,
    });
  }

  for (const t of usdTxs) {
    if (t.moneda !== "USD") continue;
    eventos.push({
      fecha: t.fechaPago || t.fechaConsumo,
      tipo: t.tipo === "ingreso" ? "ingresoUSD" : "gastoUSD",
      usd: t.monto,
      totalARS: 0,
    });
  }

  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  let tenencia = 0;       // USD en cartera
  let costoAcumARS = 0;   // costo total en pesos de la tenencia actual

  let totalCompradoUSD = 0, totalVendidoUSD = 0, totalGastadoUSD = 0;
  let totalCompradoARS = 0, totalVendidoARS = 0;

  const ppcVigente = () => (tenencia > 0 ? costoAcumARS / tenencia : 0);

  for (const ev of eventos) {
    if (ev.tipo === "compra") {
      tenencia += ev.usd;
      costoAcumARS += ev.totalARS;
      totalCompradoUSD += ev.usd;
      totalCompradoARS += ev.totalARS;
    } else if (ev.tipo === "venta") {
      const ppc = ppcVigente();
      const usdSalen = Math.min(ev.usd, tenencia);
      tenencia -= ev.usd;
      costoAcumARS -= ppc * usdSalen;
      totalVendidoUSD += ev.usd;
      totalVendidoARS += ev.totalARS;
    } else if (ev.tipo === "gastoUSD") {
      const ppc = ppcVigente();
      const usdSalen = Math.min(ev.usd, tenencia);
      tenencia -= ev.usd;
      costoAcumARS -= ppc * usdSalen;
      totalGastadoUSD += ev.usd;
    } else if (ev.tipo === "ingresoUSD") {
      // Entra al costo promedio vigente para no distorsionar el PPC
      const ppc = ppcVigente();
      tenencia += ev.usd;
      costoAcumARS += ppc * ev.usd;
    }

    if (tenencia < 0.0001) { tenencia = Math.max(tenencia, 0); costoAcumARS = 0; }
  }

  return {
    tenenciaUSD: tenencia,
    netoInvertidoARS: totalCompradoARS - totalVendidoARS,
    precioPromedioCompra: tenencia > 0 ? costoAcumARS / tenencia : 0,
    totalCompradoUSD,
    totalVendidoUSD,
    totalCompradoARS,
    totalVendidoARS,
    totalGastadoUSD,
  };
}

/**
 * Impacto neto en pesos de las operaciones de dólar sobre el acumulado:
 * las compras restan pesos (salieron de la cuenta), las ventas suman.
 * Los gastos en USD no tocan el saldo en pesos (se pagan con dólares).
 */
export function impactoPesosDolar(ops: DolarOperacion[]): number {
  return ops.reduce(
    (s, op) => s + (op.tipo === "venta" ? op.totalARS : -op.totalARS),
    0,
  );
}
