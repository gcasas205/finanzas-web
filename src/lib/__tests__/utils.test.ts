import { describe, expect, it } from "vitest";
import { calcularFechaPagoTarjeta, calcularFechaPagoSueldo, roundMoney, formatPesos, formatMes } from "@/lib/utils";

describe("calcularFechaPagoTarjeta", () => {
  it("consumo antes del cierre se paga el mes siguiente", () => {
    expect(calcularFechaPagoTarjeta("2026-03-10", 23, 5)).toBe("2026-04-05");
  });
  it("consumo después del cierre se paga dos meses después", () => {
    expect(calcularFechaPagoTarjeta("2026-03-25", 23, 5)).toBe("2026-05-05");
  });
  it("cruza de año", () => {
    expect(calcularFechaPagoTarjeta("2026-12-28", 23, 5)).toBe("2027-02-05");
  });
  it("ajusta el vencimiento a los días del mes", () => {
    expect(calcularFechaPagoTarjeta("2026-01-10", 23, 31)).toBe("2026-02-28");
  });
});

describe("calcularFechaPagoSueldo", () => {
  it("se cobra el mes siguiente por defecto", () => {
    expect(calcularFechaPagoSueldo("2026-12")).toEqual({ periodoPago: "2027-01", fechaPago: "2027-01-05" });
  });
});

describe("roundMoney", () => {
  it("redondea a centavos sin basura de float", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1234.5678)).toBe(1234.57);
  });
});

describe("formateadores", () => {
  it("formatPesos sin centavos en es-AR", () => {
    expect(formatPesos(1234567)).toMatch(/1\.234\.567/);
  });
  it("formatMes largo y corto", () => {
    expect(formatMes("2026-09")).toBe("Septiembre 2026");
    expect(formatMes("2026-09", true)).toBe("Sep '26");
  });
});
