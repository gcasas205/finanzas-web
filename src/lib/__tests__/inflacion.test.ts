import { describe, expect, it } from "vitest";
import { parseInflacion, factoresPesosDeHoy } from "@/lib/inflacion";

describe("inflación", () => {
  it("normaliza la serie y descarta filas inválidas", () => {
    const s = parseInflacion([
      { fecha: "2026-02-28", valor: 2 },
      { fecha: "2026-01-31", valor: 3 },
      { fecha: "basura", valor: 1 },
    ]);
    expect(s).toEqual([{ mes: "2026-01", pct: 3 }, { mes: "2026-02", pct: 2 }]);
  });
  it("lleva montos a pesos del último mes publicado", () => {
    const f = factoresPesosDeHoy([
      { mes: "2026-01", pct: 3 },
      { mes: "2026-02", pct: 2 },
      { mes: "2026-03", pct: 10 },
    ]);
    expect(f("2026-03")).toBe(1);
    expect(f("2026-02")).toBeCloseTo(1.1, 10);
    expect(f("2026-01")).toBeCloseTo(1.1 * 1.02, 10);
    expect(f("2026-05")).toBe(1); // sin dato todavía
  });
});
