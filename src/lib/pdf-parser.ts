import type { Transaction, Sueldo } from "@/types";
import { autoCategorizar } from "./categories";
import { calcularFechaPagoTarjeta, calcularFechaPagoSueldo, generateId } from "./utils";

// pdf-parse no tiene tipos, lo importamos dinámico
async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return decodePUA(result.text ?? "");
}

/**
 * Algunos PDFs (ej. recibos de sueldo Swissjust) usan fuentes con caracteres
 * en el Unicode Private Use Area (U+F000-U+F0FF) mapeados a ASCII restando 0xF000.
 * Si detectamos muchos caracteres en ese rango, los decodificamos.
 */
function decodePUA(text: string): string {
  if (!text) return "";
  // Contar cuántos caracteres están en PUA
  let puaCount = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xF000 && code <= 0xF0FF) puaCount++;
  }
  // Si más del 10% de los caracteres son PUA, decodificar
  if (puaCount < text.length * 0.1) return text;

  let result = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xF000 && code <= 0xF0FF) {
      const mapped = code - 0xF000;
      if (mapped >= 32 && mapped <= 126) {
        result += String.fromCharCode(mapped);
      } else {
        result += ch;
      }
    } else {
      result += ch;
    }
  }
  return result;
}

/** Parsea número con formato argentino: "1.234.567,89" → 1234567.89 */
function parseNumberAR(s: string): number {
  if (!s) return 0;
  const clean = s.trim().replace(/\s/g, "");
  // 1.234.567,89 → punto miles, coma decimal
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(clean)) {
    return parseFloat(clean.replace(/\./g, "").replace(",", "."));
  }
  // 1234567,89 → solo coma decimal
  if (/^\d+,\d{1,2}$/.test(clean)) {
    return parseFloat(clean.replace(",", "."));
  }
  // 1234567.89 → punto decimal
  if (/^\d+(\.\d{1,2})?$/.test(clean)) {
    return parseFloat(clean);
  }
  // 1,234,567.89 → coma miles, punto decimal
  if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(clean)) {
    return parseFloat(clean.replace(/,/g, ""));
  }
  return 0;
}

// ════════════════════════════════════════════════════════════════════════════
// PARSER VISA ICBC
// ════════════════════════════════════════════════════════════════════════════

export interface VisaParsedResult {
  type: "visa";
  titular: string;
  cierre: string;
  vencimiento: string;
  saldoTotal: number;
  transactions: Transaction[];
}

export async function parseVisaPDF(buffer: Buffer, cardCutoff = 23, cardDue = 5): Promise<VisaParsedResult> {
  const text = await parsePdfBuffer(buffer);
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  let titular = "";
  let cierre = "";
  let vencimientoActual = ""; // THIS is when all transactions in this statement get paid
  let saldoTotal = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("TITULAR DE CUENTA")) {
      const m = line.match(/TITULAR DE CUENTA\s+(.+?)(?:\s+\d|$)/);
      if (m) titular = m[1].trim();
    }
    if (line.includes("CIERRE ACTUAL") || /CIERRE\s+\d/.test(line)) {
      const m = line.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/);
      if (m) cierre = m[1];
    }

    // VENCIMIENTO ACTUAL: the date all transactions in this statement are due
    // pdf-parse may split this across lines:
    //   line N:   "VENCIMIENTO ACTUAL"
    //   line N+1: "05 May 26"
    // Or pdfplumber has it inline: "VENCIMIENTO ACTUAL 05 May 26"
    if (/VENCIMIENTO\s*ACTUAL/i.test(line) && !vencimientoActual) {
      const m = line.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/);
      if (m) {
        vencimientoActual = m[1];
      } else if (i + 1 < lines.length) {
        // Check next line for the date
        const m2 = lines[i + 1].match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/);
        if (m2) vencimientoActual = m2[1];
      }
    }

    if (line.includes("SALDO ACTUAL")) {
      const m = line.match(/SALDO ACTUAL[^\d]*([\d.,]+)/);
      if (m) saldoTotal = parseNumberAR(m[1]);
    }
  }

  // Parse the vencimiento actual date
  // pdf-parse may output labels and values on completely separate lines:
  //   line 9: "VENCIMIENTO ACTUAL"
  //   ...
  //   line 35: "CASAS GONZALO AGUSTIN"
  //   line 36: "05 May 26"    ← this is the vencimiento value
  //   line 37: "23 Abr 26"    ← this is the cierre value
  // Strategy: look for date pattern "DD Mon YY" right after titular name,
  // OR look for it inline with "VENCIMIENTO ACTUAL"
  let fechaPagoResumen: string | null = null;

  // Strategy 1: inline in same line as label (pdfplumber format)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/VENCIMIENTO\s*ACTUAL/i.test(line)) {
      const m = line.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})/);
      if (m) {
        const parsed = parseShortDateAR(m[1]);
        if (parsed) {
          fechaPagoResumen = `${parsed.year}-${String(parsed.month).padStart(2,"0")}-${String(parsed.day).padStart(2,"0")}`;
        }
        break;
      }
    }
  }

  // Strategy 2: pdf-parse format — first standalone "DD Mon YY" date in lines 30-50
  // In pdf-parse output, the form values appear around lines 35-40
  // Line 36 = vencimiento actual ("05 May 26"), line 37 = cierre ("23 Abr 26")
  if (!fechaPagoResumen) {
    for (let i = 25; i < Math.min(55, lines.length); i++) {
      const m = lines[i].match(/^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})$/);
      if (m) {
        const parsed = parseShortDateAR(m[1]);
        if (parsed) {
          fechaPagoResumen = `${parsed.year}-${String(parsed.month).padStart(2,"0")}-${String(parsed.day).padStart(2,"0")}`;
          break;
        }
      }
    }
  }

  // pdf-parse output: fecha pegada al comprobante sin espacio
  // "09.05.25477614*MERPAGO*ELECTRONICAFLA      C.12/12         24.999,91"
  // Some lines duplicated: "...3.844,24 24.10.25001586*MEGATONE...3.844,24"
  const txRegex = /^(\d{2}\.\d{2}\.\d{2})\s*(.+?)\s+([\d.,]+)\s*$/;
  const skipKeywords = [
    "SALDO ANTERIOR", "SU PAGO", "TARJETA", "TOTAL CONSUMOS",
    "DB IVA", "COMISION", "IIBB", "IVA RG", "DB.RG", "PAGO MINIMO", "SALDO ACTUAL",
    "DEBITAREMOS", "PLAN V"
  ];

  const transactions: Transaction[] = [];

  for (const rawLine of lines) {
    // Dedup: take first half if line contains a duplicated date pattern
    const dupMatch = rawLine.match(/^(\d{2}\.\d{2}\.\d{2}.+?[\d.,]+)\s+\d{2}\.\d{2}\.\d{2}/);
    const line = dupMatch ? dupMatch[1].trim() : rawLine;
    if (skipKeywords.some(kw => line.toUpperCase().includes(kw))) continue;

    const m = line.match(txRegex);
    if (!m) continue;

    const [, fechaRaw, descRaw, montoRaw] = m;
    let descripcion = descRaw.trim();

    // Detectar cuotas: C.03/12 o c.03/12
    let cuotaTotal = 1, cuotaNumero = 1;
    const cuotaMatch = descripcion.match(/C\.(\d+)\/(\d+)/i);
    if (cuotaMatch) {
      cuotaNumero = parseInt(cuotaMatch[1]);
      cuotaTotal = parseInt(cuotaMatch[2]);
      descripcion = descripcion.replace(cuotaMatch[0], "").trim();
    }

    // Parsear fecha DD.MM.YY → YYYY-MM-DD
    const [dd, mm, yy] = fechaRaw.split(".");
    const fechaConsumo = `20${yy}-${mm}-${dd}`;

    const monto = parseNumberAR(montoRaw);
    if (monto <= 0 || monto > 100_000_000) continue;

    // Limpiar: comprobante está pegado (ej: "477614*MERPAGO*ELECTRONICAFLA")
    // Remove leading digits+asterisk (comprobante number)
    descripcion = descripcion.replace(/^\d{4,}\*?\s*/, "").trim();
    // Remove remaining leading code patterns like "000001*"
    descripcion = descripcion.replace(/^\d+\*\s*/, "").trim();
    // Remove trailing long number codes (policy/account numbers)
    descripcion = descripcion.replace(/\s+\d{10,}\s*$/, "").trim();
    descripcion = descripcion.replace(/\s+SE\d+[-\d]+\s*$/, "").trim();
    if (!descripcion) descripcion = descRaw;

    const { categoria, subcategoria } = autoCategorizar(descripcion);

    // Fecha de pago: TODAS las transacciones del resumen se pagan en VENCIMIENTO ACTUAL
    const fechaPago = fechaPagoResumen
      || calcularFechaPagoTarjeta(fechaConsumo, cardCutoff, cardDue);

    transactions.push({
      id: generateId(),
      fechaConsumo,
      fechaPago,
      tipo: "egreso",
      descripcion: descripcion.slice(0, 80),
      monto,
      moneda: "ARS",
      categoria,
      subcategoria,
      fuente: "tarjeta",
      cuotaTotal,
      cuotaNumero,
      notas: cuotaTotal > 1 ? `Cuota ${cuotaNumero}/${cuotaTotal}` : "",
      createdAt: new Date().toISOString(),
    });
  }

  return {
    type: "visa",
    titular,
    cierre,
    vencimiento: vencimientoActual,
    saldoTotal,
    transactions,
  };
}

/** Parsea fechas tipo "05 May 26" o "21 May 2026" */
function parseShortDateAR(s: string): { year: number; month: number; day: number } | null {
  const months: Record<string, number> = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
  };
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})/);
  if (!m) return null;
  const day = parseInt(m[1]);
  const month = months[m[2].toLowerCase()];
  if (!month) return null;
  let year = parseInt(m[3]);
  if (year < 100) year += 2000;
  return { year, month, day };
}

// ════════════════════════════════════════════════════════════════════════════
// PARSER RECIBO DE SUELDO
// ════════════════════════════════════════════════════════════════════════════

import { parseSueldoText } from "./pdf-parser-sueldo";
export type { SueldoParsedResult } from "./pdf-parser-sueldo";

export async function parseSueldoPDF(
  buffer: Buffer,
  offsetMonths = 1,
) {
  const text = await parsePdfBuffer(buffer);
  return parseSueldoText(text, offsetMonths);
}
