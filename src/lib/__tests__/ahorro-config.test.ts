import { describe, expect, it } from "vitest";
import { parseAhorroConfig, ahorroConfigToEntries, parsePresupuestos, presupuestosToEntries, aporteMensualNecesario } from "@/lib/ahorro-config";

describe("config del ahorro", () => {
  it("una planilla vieja (sin sobres_lista) sigue con los 4 sobres originales", () => {
    const c = parseAhorroConfig({ mediano_auto_pct: "50", objetivo_tec: "900", sp500_retorno_anual: "8" });
    expect(c.sobres.map((s) => s.key)).toEqual(["auto", "mud", "vac", "tec"]);
    expect(c.sobres[0]).toMatchObject({ nombre: "Cambiar el auto", pct: 50 });
    expect(c.sobres[3].objetivo).toBe(900);
    expect(c.sp500RetornoAnual).toBeCloseTo(0.08);
  });
  it("lee sobres propios con nombre y fecha objetivo, y vuelve a escribirlos igual", () => {
    const raw = {
      sobres_lista: "auto,viaje_x1",
      sobre_viaje_x1_nombre: "Viaje a Japón",
      mediano_viaje_x1_pct: "60",
      objetivo_viaje_x1: "5000",
      sobre_viaje_x1_fecha: "2027-04",
      emergencia_objetivo: "2500",
    };
    const c = parseAhorroConfig(raw);
    expect(c.sobres[1]).toEqual({ key: "viaje_x1", nombre: "Viaje a Japón", pct: 60, objetivo: 5000, fechaObjetivo: "2027-04" });
    const vuelta = parseAhorroConfig(Object.fromEntries(ahorroConfigToEntries(c)));
    expect(vuelta).toEqual(c);
  });
  it("presupuestos: lee los positivos y pone en 0 los que se quitan", () => {
    expect(parsePresupuestos({ "presupuesto:Alimentación": "300000", "presupuesto:Ocio": "0", x: "1" })).toEqual({ "Alimentación": 300000 });
    expect(presupuestosToEntries({ Salud: 50000 }, { "Alimentación": 300000 })).toEqual([
      ["presupuesto:Alimentación", "0"], ["presupuesto:Salud", "50000"],
    ]);
  });
  it("aporte mensual para llegar a la fecha", () => {
    expect(aporteMensualNecesario(1200, "2026-12", "2026-10")).toEqual({ meses: 3, porMes: 400 });
    expect(aporteMensualNecesario(500, "2026-01", "2026-10").meses).toBe(1); // vencida: todo ya
  });
});
