import { describe, expect, it } from "vitest";
import { proximoResumen } from "@/lib/tarjeta";
import type { Transaction } from "@/types";

const t = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36), fechaConsumo: "2026-09-10", fechaPago: "2026-10-05", tipo: "egreso",
  descripcion: "x", monto: 100, moneda: "ARS", categoria: "Otros", subcategoria: "Varios",
  fuente: "tarjeta", cuotaTotal: 1, cuotaNumero: 1, notas: "", createdAt: "", ...p,
});

describe("proximoResumen", () => {
  it("suma el próximo vencimiento por moneda, descontando créditos", () => {
    const r = proximoResumen([
      t({ monto: 1000 }),
      t({ monto: 500, cuotaTotal: 3 }),
      t({ monto: 200, tipo: "ingreso" }),
      t({ monto: 10, moneda: "USD" }),
      t({ monto: 9999, fechaPago: "2026-11-05" }),
      t({ monto: 7777, fechaPago: "2026-09-05" }),
      t({ monto: 50, fuente: "manual" }),
    ], "2026-10-01");
    expect(r).toEqual({ vence: "2026-10-05", pesos: 1300, dolares: 10, items: 4, cuotas: 1 });
  });
  it("null si no hay nada por vencer", () => {
    expect(proximoResumen([t({ fechaPago: "2026-09-05" })], "2026-10-01")).toBeNull();
  });
});
