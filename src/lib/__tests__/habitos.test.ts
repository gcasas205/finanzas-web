import { describe, expect, it } from "vitest";
import { claveComercio, detectarSuscripciones, detectarHormiga } from "@/lib/habitos";
import type { Transaction } from "@/types";

let n = 0;
const g = (descripcion: string, monto: number, fechaPago: string, p: Partial<Transaction> = {}): Transaction => ({
  id: String(n++), fechaConsumo: fechaPago, fechaPago, tipo: "egreso", descripcion, monto, moneda: "ARS",
  categoria: "Otros", subcategoria: "Varios", fuente: "tarjeta", cuotaTotal: 1, cuotaNumero: 1, notas: "", createdAt: "", ...p,
});

describe("hábitos de gasto", () => {
  it("agrupa descripciones con códigos distintos", () => {
    expect(claveComercio("NETFLIX.COM 123456")).toBe(claveComercio("Netflix.com 98765"));
  });
  it("detecta suscripciones mensuales con aumentos", () => {
    const txs = [
      g("NETFLIX.COM 1", 8000, "2026-05-05"),
      g("NETFLIX.COM 2", 8500, "2026-06-05"),
      g("NETFLIX.COM 3", 9000, "2026-07-05"),
      g("Heladera", 900000, "2026-06-05"),
    ];
    const s = detectarSuscripciones(txs, "2026-07");
    expect(s).toHaveLength(1);
    expect(s[0].meses).toBe(3);
    expect(s[0].porAnio).toBeCloseTo((25500 / 6) * 12, 5);
  });
  it("detecta gastos hormiga chicos y frecuentes", () => {
    const cafes = Array.from({ length: 8 }, (_, i) => g("Café Martínez", 3000, `2026-07-${String(i + 1).padStart(2, "0")}`));
    const grandes = Array.from({ length: 24 }, (_, i) => g(`Compra ${String.fromCharCode(97 + i)}x`, 50000, "2026-07-15"));
    const h = detectarHormiga([...cafes, ...grandes], "2026-07");
    expect(h.map((x) => x.nombre)).toEqual(["Café Martínez"]);
    expect(h[0].porMes).toBe(8000);
  });
});
