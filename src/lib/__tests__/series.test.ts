import { describe, expect, it } from "vitest";
import { serieMensual, ultimosMeses } from "@/lib/series";

const t = (fechaPago: string, tipo: "ingreso" | "egreso", monto: number) => ({ fechaPago, tipo, monto });

describe("serieMensual", () => {
  const serie = serieMensual([
    t("2026-01-05", "ingreso", 100),
    t("2026-01-20", "egreso", 30),
    t("2026-03-05", "ingreso", 100),
    t("2026-12-05", "egreso", 999), // cuota futura
  ], "2026-04");

  it("rellena los meses sin datos y corta en el mes pedido", () => {
    expect(serie.map((m) => m.mes)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(serie[1]).toMatchObject({ ingresos: 0, egresos: 0, ahorro: 0 });
  });
  it("el acumulado viene de toda la historia aunque se miren los últimos meses", () => {
    expect(ultimosMeses(serie, 2).map((m) => m.acumulado)).toEqual([170, 170]);
  });
  it("sin datos devuelve vacío", () => {
    expect(serieMensual([], "2026-04")).toEqual([]);
  });
});
