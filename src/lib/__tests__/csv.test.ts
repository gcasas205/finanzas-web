import { describe, expect, it } from "vitest";
import { transactionsToCsv } from "@/lib/csv";
import type { Transaction } from "@/types";

const tx: Transaction = {
  id: "1", fechaConsumo: "2026-09-01", fechaPago: "2026-10-05", tipo: "egreso",
  descripcion: 'Café "La Esquina"; centro', monto: 1500.5, moneda: "ARS",
  categoria: "Alimentación", subcategoria: "Cafetería", fuente: "tarjeta",
  cuotaTotal: 3, cuotaNumero: 1, notas: "", createdAt: "",
};

describe("transactionsToCsv", () => {
  it("usa ; y coma decimal, y escapa comillas y separadores", () => {
    const [header, fila] = transactionsToCsv([tx]).replace("﻿", "").split("\r\n");
    expect(header.startsWith("Fecha de pago;")).toBe(true);
    expect(fila).toContain('"Café ""La Esquina""; centro"');
    expect(fila).toContain(";1500,5;ARS;");
    expect(fila).toContain(";1/3;");
  });
});
