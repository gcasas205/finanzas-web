import { describe, expect, it } from "vitest";
import { parseVisaText } from "@/lib/pdf-parser";

// Líneas como las devuelve pdf-parse (fecha pegada al comprobante). Datos inventados.
const texto = [
  "VENCIMIENTO ACTUAL 05 Sep 26",
  "SALDO ANTERIOR 536.216,49 37,86",
  "03.08.26 SU PAGO EN PESOS 536.216,49-",
  "03.08.26 SU PAGO EN USD 37,86-",
  "04.08.26 DEV.IMP. RG 5617 30%( 56146,38) 16.843,91-",
  "24.10.25001586*MEGATONE ICBC MAL C.10/12 3.844,24",
  "25.07.26007852*PEDIDOSYA*WEISS BURGER 16.625,00",
  "30.07.26412602 APPLE.COM/BILL MV8MTS29JUSD 2,99 2,99",
  "31.07.26 DB IVA 21% 1.234,56",
  "31.07.26 COMISION MANTENIMIENTO 5.000,00",
].join("\n");

describe("parseVisaText", () => {
  const r = parseVisaText(texto, 23, 5);
  const por = (d: string) => r.transactions.find((t) => t.descripcion.includes(d));

  it("ignora saldos y pagos", () => {
    expect(r.transactions.some((t) => /SU PAGO|SALDO/.test(t.descripcion))).toBe(false);
  });
  it("todo se paga en el vencimiento del resumen", () => {
    expect(r.transactions.every((t) => t.fechaPago === "2026-09-05")).toBe(true);
  });
  it("detecta consumos en dólares", () => {
    const apple = por("APPLE");
    expect(apple?.moneda).toBe("USD");
    expect(apple?.monto).toBe(2.99);
    expect(apple?.descripcion).not.toMatch(/USD/);
  });
  it("los consumos en pesos siguen en pesos, con cuotas", () => {
    const m = por("MEGATONE");
    expect(m?.moneda).toBe("ARS");
    expect(m?.cuotaNumero).toBe(10);
    expect(m?.cuotaTotal).toBe(12);
    expect(por("PEDIDOSYA")?.monto).toBe(16625);
  });
  it("importa impuestos y comisiones en Finanzas", () => {
    expect(por("DB IVA")?.subcategoria).toBe("Impuesto");
    expect(por("COMISION")?.subcategoria).toBe("Comisión");
  });
  it("los créditos entran como reintegro", () => {
    const dev = por("DEV.IMP");
    expect(dev?.tipo).toBe("ingreso");
    expect(dev?.monto).toBe(16843.91);
    expect(dev?.subcategoria).toBe("Reintegro");
  });
});
