import type { Transaction } from "@/types";

/** Celda CSV: entre comillas si trae separador, comillas o saltos de línea. */
function celda(v: string | number): string {
  const s = typeof v === "number" ? String(v).replace(".", ",") : v;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Movimientos a CSV para Excel/Sheets en castellano: separador `;`, coma
 * decimal y BOM para que respete los acentos.
 */
export function transactionsToCsv(txs: Transaction[]): string {
  const header = [
    "Fecha de pago", "Fecha de consumo", "Tipo", "Descripción", "Monto", "Moneda",
    "Categoría", "Subcategoría", "Fuente", "Cuota", "Notas",
  ];
  const rows = txs.map((t) => [
    t.fechaPago, t.fechaConsumo, t.tipo === "ingreso" ? "Ingreso" : "Gasto", t.descripcion, t.monto, t.moneda,
    t.categoria, t.subcategoria, t.fuente, t.cuotaTotal > 1 ? `${t.cuotaNumero}/${t.cuotaTotal}` : "", t.notas,
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(celda).join(";")).join("\r\n");
}

/** Descarga un texto como archivo desde el navegador. */
export function descargarArchivo(nombre: string, contenido: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
