import { describe, expect, it } from "vitest";
import { expandirCuotas, sumarMeses } from "@/lib/cuotas";
import { esSueldo, sueldoDesdeMovimiento } from "@/lib/sueldos";
import { separarDuplicados } from "@/lib/duplicados";
import type { Transaction } from "@/types";

const base: Transaction = {
  id: "t1", fechaConsumo: "2026-08-20", fechaPago: "2026-09-05", tipo: "egreso", descripcion: "Heladera",
  monto: 50000, moneda: "ARS", categoria: "Vivienda", subcategoria: "Mantenimiento", fuente: "tarjeta",
  cuotaTotal: 6, cuotaNumero: 3, notas: "Cuota 3/6", createdAt: "",
};

describe("cuotas", () => {
  it("sumarMeses respeta fin de mes", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2026-11-05", 3)).toBe("2027-02-05");
  });
  it("genera las cuotas que faltan, una por mes y en el mismo grupo", () => {
    let n = 0;
    const r = expandirCuotas(base, "g1", () => `n${n++}`);
    expect(r.map((t) => t.cuotaNumero)).toEqual([3, 4, 5, 6]);
    expect(r.map((t) => t.fechaPago)).toEqual(["2026-09-05", "2026-10-05", "2026-11-05", "2026-12-05"]);
    expect(r.every((t) => t.grupoCuotas === "g1" && t.fechaConsumo === "2026-08-20")).toBe(true);
    expect(r[0].id).toBe("t1");
    expect(r[3].notas).toBe("Cuota 6/6");
  });
  it("una compra en un pago o la última cuota no genera nada", () => {
    expect(expandirCuotas({ ...base, cuotaTotal: 1, cuotaNumero: 1 }, "g", () => "x")).toHaveLength(1);
    expect(expandirCuotas({ ...base, cuotaNumero: 6 }, "g", () => "x")).toHaveLength(1);
  });
  it("una cuota importada se reconoce aunque la descripción cambie", () => {
    const r = separarDuplicados([{ ...base, cuotaNumero: 4, descripcion: "MEGATONE ICBC MAL" }], [{ ...base, cuotaNumero: 4 }]);
    expect(r.duplicados).toHaveLength(1);
  });
});

describe("sueldos", () => {
  const ingreso: Transaction = {
    ...base, id: "s1", tipo: "ingreso", categoria: "Ingresos", subcategoria: "Sueldo", fuente: "manual",
    fechaPago: "2026-10-03", fechaConsumo: "2026-10-03", monto: 1_200_000, cuotaTotal: 1, cuotaNumero: 1, notas: "",
  };
  it("reconoce un sueldo", () => {
    expect(esSueldo(ingreso)).toBe(true);
    expect(esSueldo({ ...ingreso, moneda: "USD" })).toBe(false);
    expect(esSueldo({ ...ingreso, subcategoria: "Bono" })).toBe(false);
  });
  it("arma la fila con neto y período del movimiento, y período trabajado por desfase", () => {
    const s = sueldoDesdeMovimiento(ingreso, 1, { empresa: "ACME", bruto: 1_600_000 });
    expect(s).toMatchObject({ txId: "s1", neto: 1_200_000, periodoPago: "2026-10", periodoTrabajado: "2026-09", empresa: "ACME", bruto: 1_600_000 });
  });
  it("al editar sin datos del recibo conserva los que ya estaban", () => {
    const previo = sueldoDesdeMovimiento(ingreso, 1, { empresa: "ACME", bruto: 1_600_000, periodoTrabajado: "2026-08" });
    const s = sueldoDesdeMovimiento({ ...ingreso, monto: 1_250_000 }, 1, undefined, previo);
    expect(s).toMatchObject({ id: previo.id, empresa: "ACME", bruto: 1_600_000, periodoTrabajado: "2026-08", neto: 1_250_000 });
  });
});
