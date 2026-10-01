import { describe, expect, it } from "vitest";
import { resumenDolar } from "@/lib/dolar-calc";
import { computeAhorro } from "@/lib/ahorro-calc";
import type { AhorroConfig, DolarOperacion, Transaction } from "@/types";

const op = (p: Partial<DolarOperacion>): DolarOperacion => ({
  id: Math.random().toString(36),
  fecha: "2026-01-01",
  tipo: "compra",
  montoUSD: 0,
  precioARS: 0,
  totalARS: 0,
  notas: "",
  createdAt: "",
  ...p,
});

const usdTx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  fechaConsumo: "2026-01-01",
  fechaPago: "2026-01-01",
  tipo: "egreso",
  descripcion: "x",
  monto: 0,
  moneda: "USD",
  categoria: "Otros",
  subcategoria: "Sin categoría",
  fuente: "manual",
  cuotaTotal: 1,
  cuotaNumero: 1,
  notas: "",
  createdAt: "",
  ...p,
});

describe("resumenDolar", () => {
  it("precio promedio ponderado de compra", () => {
    const r = resumenDolar([
      op({ fecha: "2026-01-01", montoUSD: 100, precioARS: 1000, totalARS: 100_000 }),
      op({ fecha: "2026-02-01", montoUSD: 100, precioARS: 1200, totalARS: 120_000 }),
    ]);
    expect(r.tenenciaUSD).toBe(200);
    expect(r.precioPromedioCompra).toBeCloseTo(1100);
  });
  it("vender y gastar reduce la tenencia sin cambiar el precio promedio", () => {
    const r = resumenDolar(
      [
        op({ fecha: "2026-01-01", montoUSD: 200, precioARS: 1000, totalARS: 200_000 }),
        op({ fecha: "2026-02-01", tipo: "venta", montoUSD: 50, precioARS: 1300, totalARS: 65_000 }),
      ],
      [usdTx({ fechaPago: "2026-03-01", monto: 30 })],
    );
    expect(r.tenenciaUSD).toBe(120);
    expect(r.precioPromedioCompra).toBeCloseTo(1000);
    expect(r.totalGastadoUSD).toBe(30);
  });
});

describe("computeAhorro", () => {
  const cfg: AhorroConfig = {
    emergenciaObjetivo: 1000,
    sp500RetornoAnual: 0.07,
    sobres: [
      { key: "auto", nombre: "Auto", pct: 50, objetivo: 1000 },
      { key: "mud", nombre: "Mudanza", pct: 50, objetivo: 1000 },
      { key: "vac", nombre: "Vacaciones", pct: 0, objetivo: 0 },
      { key: "tec", nombre: "Tecnología", pct: 0, objetivo: 0 },
    ],
  };
  it("el piso se llena primero", () => {
    const r = computeAhorro([op({ montoUSD: 600, asigMediano: 300 })], [], cfg);
    expect(r.emergencia.balance).toBe(600);
    expect(r.emergencia.completo).toBe(false);
    expect(r.mediano.balance).toBe(0);
  });
  it("lo asignado siempre cuadra con la tenencia", () => {
    const r = computeAhorro(
      [
        op({ fecha: "2026-01-01", montoUSD: 1500, asigMediano: 400, asigLargo: 100 }),
        op({ fecha: "2026-02-01", tipo: "venta", montoUSD: 200 }),
      ],
      [],
      cfg,
    );
    expect(r.tenenciaNeta).toBe(1300);
    expect(Math.abs(r.descuadre)).toBeLessThan(0.01);
  });
  it("un ingreso USD de Movimientos respeta su reparto", () => {
    const r = computeAhorro(
      [op({ montoUSD: 1000 })],
      [usdTx({ tipo: "ingreso", monto: 500, asigMediano: 100, asigLargo: 400 })],
      cfg,
    );
    expect(r.emergencia.balance).toBe(1000);
    expect(r.largo.balance).toBe(400);
    expect(r.mediano.balance).toBe(100);
  });
  it("los montos asignados son exactos y lo no asignado va a mediano", () => {
    const r = computeAhorro(
      [
        op({ fecha: "2026-01-01", montoUSD: 1000 }),
        op({ fecha: "2026-02-01", montoUSD: 1000, asigLargo: 100 }),
      ],
      [],
      cfg,
    );
    expect(r.largo.balance).toBe(100);
    expect(r.mediano.balance).toBe(900);
  });
  it("si el piso se lleva parte, lo asignado se achica en proporción", () => {
    // piso vacío (1000): de 1200 quedan 200 para repartir; se pidió 300 mediano + 100 largo
    const r = computeAhorro([op({ montoUSD: 1200, asigMediano: 300, asigLargo: 100 })], [], cfg);
    expect(r.emergencia.balance).toBe(1000);
    expect(r.largo.balance).toBe(50);
    expect(r.mediano.balance).toBe(150);
  });
});
