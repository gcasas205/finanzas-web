import { describe, expect, it } from "vitest";
import { parseDolarApi } from "@/lib/dolar";

describe("parseDolarApi", () => {
  it("lee compra, venta y fecha", () => {
    const r = parseDolarApi({ compra: 1400, venta: 1450, fechaActualizacion: "2026-10-01T14:30:00.000Z" });
    expect(r).toEqual({ compra: 1400, venta: 1450, actualizado: "2026-10-01T14:30:00.000Z" });
  });
  it("rechaza valores implausibles", () => {
    expect(() => parseDolarApi({ compra: 0, venta: 0 })).toThrow();
    expect(() => parseDolarApi({ compra: 1500, venta: 1400 })).toThrow();
    expect(() => parseDolarApi(null)).toThrow();
  });
});
