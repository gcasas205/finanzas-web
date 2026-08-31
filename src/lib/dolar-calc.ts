import type { DolarOperacion } from "@/types";

export interface DolarResumen {
  /** USD actualmente en cartera (compras − ventas) */
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
}

/**
 * Calcula la tenencia y el precio promedio de compra usando el método
 * de costo promedio ponderado: las ventas reducen la tenencia al costo
 * promedio vigente, sin alterar el precio promedio de lo que queda.
 * Las operaciones se procesan en orden cronológico.
 */
export function resumenDolar(ops: DolarOperacion[]): DolarResumen {
  const ordenadas = [...ops].sort((a, b) => a.fecha.localeCompare(b.fecha));

  let tenencia = 0;          // USD en cartera
  let costoAcumARS = 0;      // costo total en pesos de la tenencia actual

  let totalCompradoUSD = 0, totalVendidoUSD = 0;
  let totalCompradoARS = 0, totalVendidoARS = 0;

  for (const op of ordenadas) {
    if (op.tipo === "compra") {
      tenencia += op.montoUSD;
      costoAcumARS += op.totalARS;
      totalCompradoUSD += op.montoUSD;
      totalCompradoARS += op.totalARS;
    } else {
      // venta: saca USD al costo promedio vigente
      const ppc = tenencia > 0 ? costoAcumARS / tenencia : 0;
      const usdVendidos = Math.min(op.montoUSD, tenencia);
      tenencia -= op.montoUSD;
      costoAcumARS -= ppc * usdVendidos;
      if (tenencia < 0.0001) { tenencia = Math.max(tenencia, 0); costoAcumARS = 0; }
      totalVendidoUSD += op.montoUSD;
      totalVendidoARS += op.totalARS;
    }
  }

  return {
    tenenciaUSD: tenencia,
    netoInvertidoARS: totalCompradoARS - totalVendidoARS,
    precioPromedioCompra: tenencia > 0 ? costoAcumARS / tenencia : 0,
    totalCompradoUSD,
    totalVendidoUSD,
    totalCompradoARS,
    totalVendidoARS,
  };
}

/**
 * Impacto neto en pesos de las operaciones de dólar sobre el acumulado:
 * las compras restan pesos (salieron de la cuenta), las ventas suman.
 * Es decir: ventasARS − comprasARS.
 */
export function impactoPesosDolar(ops: DolarOperacion[]): number {
  return ops.reduce(
    (s, op) => s + (op.tipo === "venta" ? op.totalARS : -op.totalARS),
    0,
  );
}
