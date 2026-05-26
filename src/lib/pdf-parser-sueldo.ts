/**
 * Parser de recibo de sueldo optimizado para el formato Swissjust / recibos argentinos.
 *
 * Estructura esperada del texto extraído (tras PUA decode):
 *   L0:  "Pgina 1 de 1"
 *   L1:  "SWISSJUST LOGISTICA SA"             ← empresa
 *   L2:  "Direccin : Av Libertador ..."
 *   ...
 *   L7:  "04/2026 ABRIL 2026 04/05/2026 ..."  ← período abonado + fecha pago
 *   ...
 *   L9:  " 25 CASAS , GONZALO AGUSTIN ..."    ← empleado
 *   L10: "Jerarqua : DATA ANALYST JUNIOR ..." ← cargo
 *   ...
 *   L19: "SUELDO BASICO  10001  1,950,000.00"
 *   L20: "JUBILACION  20000  11.00 %  214,500.00"
 *   L21: "LEY 19032  20002  3.00 %  58,500.00"
 *   L22: "OBRA SOCIAL  20005  58,500.00"
 *   ...
 *   L24: "Total Bruto :  1,950,000.00"
 *   L25: "Total Neto :  1,618,500.00 Son: Pesos ..."
 */

import type { Sueldo, Transaction } from "@/types";
import { calcularFechaPagoSueldo, generateId } from "./utils";

/** Parsea número: "1,950,000.00" o "1.950.000,00" → 1950000 */
function parseNum(s: string): number {
  if (!s) return 0;
  const clean = s.trim();
  // "1,950,000.00" → comma=thousands, dot=decimal (US-style que usa el PDF de Swissjust)
  if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(clean)) {
    return parseFloat(clean.replace(/,/g, ""));
  }
  // "1.950.000,00" → AR style
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(clean)) {
    return parseFloat(clean.replace(/\./g, "").replace(",", "."));
  }
  // fallback
  return parseFloat(clean.replace(/[^0-9.-]/g, "")) || 0;
}

/** Extrae todos los números >100 de una línea */
function numsFromLine(line: string): number[] {
  const matches = line.match(/[\d,]+\.\d{2}/g) ?? [];
  // también formato AR
  const matchesAR = line.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) ?? [];
  const all = [...matches, ...matchesAR].map(parseNum).filter(n => n > 100);
  return [...new Set(all)]; // deduplicar
}

export interface SueldoParsedResult {
  type: "sueldo";
  sueldo: Sueldo;
  ingresoTransaction: Transaction | null;
}

const MONTHS_ES: Record<string, string> = {
  ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04",
  MAYO: "05", JUNIO: "06", JULIO: "07", AGOSTO: "08",
  SEPTIEMBRE: "09", OCTUBRE: "10", NOVIEMBRE: "11", DICIEMBRE: "12",
};

export function parseSueldoText(
  text: string,
  offsetMonths = 1,
): SueldoParsedResult {
  const lines = text.split("\n").map(l => l.trim());
  const nonEmpty = lines.filter(Boolean);

  // ══════════════════════════════════════════════════════════════
  // EMPRESA: buscar línea con SA/SRL/etc en las primeras 6 líneas
  // Excluir "Pgina", "Direccin", "Localidad", "C.U.I.T"
  // ══════════════════════════════════════════════════════════════
  let empresa = "";
  const skipEmpresa = ["PGINA", "PAGINA", "DIRECCION", "DIRECCIN", "LOCALIDAD", "C.U.I.T", "ACTIVIDAD", "RECIBO"];
  for (let i = 0; i < Math.min(8, nonEmpty.length); i++) {
    const lineU = nonEmpty[i].toUpperCase();
    if (skipEmpresa.some(sk => lineU.includes(sk))) continue;
    if (lineU.includes(" SA") || lineU.includes("S.A.") || lineU.includes("SRL") || lineU.includes("S.R.L") || lineU.includes("LTDA") || lineU.includes("S.A.U")) {
      empresa = nonEmpty[i].trim().slice(0, 60);
      break;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // PERÍODO TRABAJADO: buscar la línea del "Período abonado"
  // Formato: "04/2026 ABRIL 2026 04/05/2026 AV DEL..."
  // La clave es buscar "MM/YYYY" seguido de "NOMBRE_MES YYYY"
  // ══════════════════════════════════════════════════════════════
  let periodoTrabajado = "";
  let fechaPagoRecibo = "";

  for (let i = 0; i < nonEmpty.length; i++) {
    const line = nonEmpty[i];
    const lineU = line.toUpperCase();

    // Buscar línea que contenga un nombre de mes + año (ej: "ABRIL 2026")
    for (const [mesName, mesNum] of Object.entries(MONTHS_ES)) {
      const re = new RegExp(`${mesName}\\s+(\\d{4})`);
      const m = lineU.match(re);
      if (m) {
        periodoTrabajado = `${m[1]}-${mesNum}`;

        // En la misma línea, buscar fecha de pago: DD/MM/YYYY
        const fpMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (fpMatch) {
          fechaPagoRecibo = `${fpMatch[3]}-${fpMatch[2]}-${fpMatch[1]}`;
        }
        break;
      }
    }
    if (periodoTrabajado) break;

    // Fallback: "MM/YYYY" en línea de período (pero NO si es fecha DD/MM/YYYY)
    // Solo si la línea anterior mencionaba "período" o es la línea 7-ish
    if (i <= 10) {
      const mmYYYY = line.match(/^(\d{2})\/(\d{4})\b/);
      if (mmYYYY) {
        periodoTrabajado = `${mmYYYY[2]}-${mmYYYY[1]}`;
        // Buscar fecha pago en la misma línea
        const fpMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (fpMatch) {
          fechaPagoRecibo = `${fpMatch[3]}-${fpMatch[2]}-${fpMatch[1]}`;
        }
        break;
      }
    }
  }

  if (!periodoTrabajado) {
    const d = new Date();
    periodoTrabajado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  // ══════════════════════════════════════════════════════════════
  // EMPLEADO
  // ══════════════════════════════════════════════════════════════
  let empleado = "";
  for (const line of nonEmpty) {
    const m = line.match(/CASAS\s*,\s*GONZALO\s+AGUSTIN/i);
    if (m) { empleado = m[0].trim(); break; }
    // Genérico: APELLIDO , NOMBRE
    const m2 = line.match(/([A-ZÁÉÍÓÚÑ]+)\s*,\s*([A-ZÁÉÍÓÚÑ\s]{3,})/);
    if (m2 && !line.includes("Direccion") && !line.includes("Direccin")) {
      empleado = m2[0].trim().slice(0, 50);
      break;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CARGO: buscar "Jerarquía :" o "Tarea" específicamente
  // NO matchear líneas con montos numéricos
  // ══════════════════════════════════════════════════════════════
  let cargo = "";
  for (const line of nonEmpty) {
    // pdfplumber: "Jerarquía : DATA ANALYST JUNIOR Obra social : 400800"
    const m = line.match(/Jerarqu[ií]a\s*:?\s*(.+?)(?:\s+Obra|\s+$)/i);
    if (m) {
      cargo = m[1].trim().slice(0, 60);
      break;
    }
  }
  // Fallback: look for "DATA ANALYST" pattern in any line
  if (!cargo) {
    for (const line of nonEmpty) {
      // Match "DATA ANALYST JR" or "DATA ANALYST JUNIOR" NOT followed by tons of numbers
      const m = line.match(/(DATA\s+ANALYST[A-Z\s]*(?:JR|SR|JUNIOR|SENIOR)?)\b/i);
      if (m) {
        cargo = m[1].trim();
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  // MONTOS: Total Bruto, Total Neto, y retenciones individuales
  // pdf-parse may output:
  //   "1,950,000.00 10001SUELDO BASICO"  (amount BEFORE label)
  //   "11.00 % 214,500.00 20000JUBILACION"  (amount BEFORE label)
  //   "Total Bruto"  (label alone, amount on next/prev line)
  //   ":Total Neto"  (label alone)
  //   OR pdfplumber format:
  //   "Total Bruto :  1,950,000.00"  (label BEFORE amount)
  // ══════════════════════════════════════════════════════════════
  let bruto = 0, neto = 0, jubilacion = 0, obraSocial = 0, ley19032 = 0;

  for (let i = 0; i < nonEmpty.length; i++) {
    const line = nonEmpty[i];
    const lineU = line.toUpperCase();
    const nums = numsFromLine(line);

    // --- Retenciones: label on same line as amount ---
    if (/JUBILACI[OÓ]N|JUBILACION/i.test(lineU) && jubilacion === 0 && nums.length) {
      jubilacion = Math.max(...nums);
      continue;
    }
    if (/19032|LEY\s*19/i.test(lineU) && ley19032 === 0 && nums.length) {
      ley19032 = Math.max(...nums);
      continue;
    }
    if (/OBRA\s*SOCIAL/i.test(lineU) && obraSocial === 0 && nums.length) {
      obraSocial = Math.max(...nums);
      continue;
    }

    // --- SUELDO BASICO: may have amount on same line ---
    if (/SUELDO\s*BASICO/i.test(lineU) && nums.length && bruto === 0) {
      bruto = Math.max(...nums);
      continue;
    }

    // --- Total Bruto / Total Neto: amount may be on same line or adjacent ---
    if (/TOTAL\s*BRUTO/i.test(lineU)) {
      if (nums.length) {
        bruto = Math.max(...nums);
      } else {
        // Look at previous and next lines for the number
        const prevNums = i > 0 ? numsFromLine(nonEmpty[i - 1]) : [];
        const nextNums = i + 1 < nonEmpty.length ? numsFromLine(nonEmpty[i + 1]) : [];
        const candidates = [...prevNums, ...nextNums];
        if (candidates.length) bruto = Math.max(...candidates);
      }
      continue;
    }
    if (/TOTAL\s*NETO/i.test(lineU)) {
      if (nums.length) {
        neto = Math.max(...nums);
      } else {
        const prevNums = i > 0 ? numsFromLine(nonEmpty[i - 1]) : [];
        const nextNums = i + 1 < nonEmpty.length ? numsFromLine(nonEmpty[i + 1]) : [];
        const candidates = [...prevNums, ...nextNums];
        if (candidates.length) neto = Math.max(...candidates);
      }
      continue;
    }
  }

  // Si no encontró neto pero tiene bruto y retenciones, calcular
  if (neto === 0 && bruto > 0) {
    neto = bruto - jubilacion - obraSocial - ley19032;
  }

  // ══════════════════════════════════════════════════════════════
  // PERÍODOS DE PAGO
  // ══════════════════════════════════════════════════════════════
  const { periodoPago, fechaPago: fechaPagoCalc } = calcularFechaPagoSueldo(periodoTrabajado, offsetMonths);
  // Preferir la fecha del recibo si la tenemos
  const fechaPagoFinal = fechaPagoRecibo || fechaPagoCalc;

  const sueldo: Sueldo = {
    id: generateId(),
    periodoTrabajado,
    periodoPago,
    empresa,
    cargo,
    bruto,
    neto,
    jubilacion,
    obraSocial,
    ley19032,
    otrosDescuentos: Math.max(0, bruto - neto - jubilacion - obraSocial - ley19032),
    fechaPago: fechaPagoFinal,
    createdAt: new Date().toISOString(),
  };

  let ingresoTransaction: Transaction | null = null;
  if (neto > 0) {
    ingresoTransaction = {
      id: generateId(),
      fechaConsumo: fechaPagoFinal,
      fechaPago: fechaPagoFinal,
      tipo: "ingreso",
      descripcion: `Sueldo ${periodoTrabajado} — ${empresa || "Empresa"}`,
      monto: neto,
      moneda: "ARS",
      categoria: "Ingresos",
      subcategoria: "Sueldo",
      fuente: "recibo",
      cuotaTotal: 1,
      cuotaNumero: 1,
      notas: `Período trabajado: ${periodoTrabajado} · Empleado: ${empleado}`,
      createdAt: new Date().toISOString(),
    };
  }

  return { type: "sueldo", sueldo, ingresoTransaction };
}
