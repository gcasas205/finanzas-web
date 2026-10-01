import { describe, expect, it } from "vitest";
import { rowToTransaction, transactionToRow, rowToSueldo, sueldoToRow } from "@/lib/sheets";
import type { Transaction } from "@/types";

const tx: Transaction = {
  id: "t1",
  fechaConsumo: "2026-09-10",
  fechaPago: "2026-09-10",
  tipo: "ingreso",
  descripcion: "Cobro en USD",
  monto: 500,
  moneda: "USD",
  categoria: "Ingresos",
  subcategoria: "Otros",
  fuente: "manual",
  cuotaTotal: 1,
  cuotaNumero: 1,
  notas: "",
  createdAt: "2026-09-10T12:00:00.000Z",
  asigMediano: 200,
  asigLargo: 150,
};

describe("fila de Transacciones", () => {
  it("guarda el reparto al final (columnas P y Q) y lo vuelve a leer", () => {
    const row = transactionToRow(tx);
    expect(row).toHaveLength(18);
    expect(row.slice(15)).toEqual([200, 150, ""]);
    const back = rowToTransaction(row);
    expect(back.asigMediano).toBe(200);
    expect(back.asigLargo).toBe(150);
  });
  it("una fila vieja sin esas columnas se lee sin reparto", () => {
    const vieja = transactionToRow(tx).slice(0, 15);
    const back = rowToTransaction(vieja);
    expect(back.asigMediano).toBeUndefined();
    expect(back.asigLargo).toBeUndefined();
  });
});

describe("columnas nuevas", () => {
  it("grupoCuotas va en la columna R", () => {
    const row = transactionToRow({ ...tx, grupoCuotas: "g1" });
    expect(row[17]).toBe("g1");
    expect(rowToTransaction(row).grupoCuotas).toBe("g1");
    expect(rowToTransaction(row.slice(0, 17)).grupoCuotas).toBeUndefined();
  });
  it("txId va al final de Sueldos (columna N)", () => {
    const row = sueldoToRow({
      id: "s", periodoTrabajado: "2026-09", periodoPago: "2026-10", empresa: "", cargo: "", bruto: 0, neto: 1,
      jubilacion: 0, obraSocial: 0, ley19032: 0, otrosDescuentos: 0, fechaPago: "2026-10-03", createdAt: "x", txId: "t9",
    });
    expect(row).toHaveLength(14);
    expect(rowToSueldo(row).txId).toBe("t9");
    expect(rowToSueldo(row.slice(0, 13)).txId).toBeUndefined();
  });
});
