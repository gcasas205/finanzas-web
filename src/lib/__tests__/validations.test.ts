import { describe, expect, it } from "vitest";
import { TransactionSchema, DolarOpSchema, ConfigSchema, TransactionImportSchema } from "@/lib/validations";
import { zodToAppError } from "@/lib/errors";

const base = {
  fechaConsumo: "2026-09-10",
  tipo: "egreso",
  descripcion: "Supermercado",
  monto: 1500.555,
  categoria: "Alimentación",
  subcategoria: "Supermercado",
};

describe("TransactionSchema", () => {
  it("acepta un movimiento válido, aplica defaults y redondea el monto", () => {
    const r = TransactionSchema.parse(base);
    expect(r.monto).toBe(1500.56);
    expect(r.moneda).toBe("ARS");
    expect(r.cuotaTotal).toBe(1);
  });
  it("descarta campos desconocidos", () => {
    const r = TransactionSchema.parse({ ...base, hackeo: true });
    expect("hackeo" in r).toBe(false);
  });
  it("rechaza fechas que no existen", () => {
    const r = TransactionSchema.safeParse({ ...base, fechaConsumo: "2026-02-30" });
    expect(r.success).toBe(false);
  });
  it("rechaza monto 0 o negativo con mensaje en castellano y campo", () => {
    const r = TransactionSchema.safeParse({ ...base, monto: 0 });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = zodToAppError(r.error);
      expect(e.field).toBe("monto");
      expect(e.message).toMatch(/mayor a 0/);
      expect(e.status).toBe(400);
    }
  });
  it("la cuota no puede superar al total", () => {
    const r = TransactionSchema.safeParse({ ...base, cuotaTotal: 3, cuotaNumero: 4 });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodToAppError(r.error).field).toBe("cuotaNumero");
  });
  it("la importación tiene tope", () => {
    const muchos = Array.from({ length: 501 }, () => base);
    expect(TransactionImportSchema.safeParse(muchos).success).toBe(false);
  });
});

describe("DolarOpSchema", () => {
  const op = { fecha: "2026-09-01", tipo: "compra", montoUSD: 100, precioARS: 1000 };
  it("acepta una compra válida", () => {
    expect(DolarOpSchema.safeParse(op).success).toBe(true);
  });
  it("rechaza asignar más de lo comprado", () => {
    const r = DolarOpSchema.safeParse({ ...op, asigMediano: 80, asigLargo: 30 });
    expect(r.success).toBe(false);
    if (!r.success) expect(zodToAppError(r.error).field).toBe("asigMediano");
  });
  it("en una venta no aplica el reparto", () => {
    expect(DolarOpSchema.safeParse({ ...op, tipo: "venta", asigMediano: 500 }).success).toBe(true);
  });
  it("exige precio positivo", () => {
    expect(DolarOpSchema.safeParse({ ...op, precioARS: 0 }).success).toBe(false);
  });
});

describe("ConfigSchema", () => {
  it("valida rangos de días de tarjeta", () => {
    expect(ConfigSchema.safeParse({ cardCutoffDay: 32 }).success).toBe(false);
    expect(ConfigSchema.safeParse({ cardDueDay: 0 }).success).toBe(false);
    expect(ConfigSchema.safeParse({ cardCutoffDay: 23, cardDueDay: 5, mpTna: 27 }).success).toBe(true);
  });
  it("rechaza un Sheet ID con caracteres raros", () => {
    expect(ConfigSchema.safeParse({ googleSheetId: "../../etc" }).success).toBe(false);
  });
});
