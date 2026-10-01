import { describe, expect, it } from "vitest";
import { fechaDelMes, pendientesDelMes } from "@/lib/recurrentes";
import type { Recurrente } from "@/types";

const r = (p: Partial<Recurrente>): Recurrente => ({
  id: "x", descripcion: "Alquiler", monto: 1, moneda: "ARS", tipo: "egreso", categoria: "Vivienda",
  subcategoria: "Alquiler", fuente: "manual", dia: 10, activo: true, ultimoMes: "", createdAt: "", ...p,
});

describe("gastos fijos", () => {
  it("el día 31 en febrero cae el último día", () => {
    expect(fechaDelMes("2026-02", 31)).toBe("2026-02-28");
    expect(fechaDelMes("2026-10", 5)).toBe("2026-10-05");
  });
  it("pendientes: activos y no cargados en el mes, ordenados por día", () => {
    const p = pendientesDelMes([
      r({ id: "a", dia: 20 }),
      r({ id: "b", dia: 1, ultimoMes: "2026-09" }),
      r({ id: "c", ultimoMes: "2026-10" }),
      r({ id: "d", activo: false }),
    ], "2026-10");
    expect(p.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
