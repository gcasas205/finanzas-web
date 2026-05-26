import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format as Argentine pesos: $1.234.567,89 */
export function formatPesos(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Compact format: $1.2M, $345K */
export function formatPesosCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MESES_ES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export function formatMes(mes: string, corto = false): string {
  const [yyyy, mm] = mes.split("-");
  const idx = parseInt(mm, 10) - 1;
  if (idx < 0 || idx > 11) return mes;
  return corto ? `${MESES_ES_CORTO[idx]} '${yyyy.slice(2)}` : `${MESES_ES[idx]} ${yyyy}`;
}

export function formatFecha(iso: string): string {
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}/${mm}/${yyyy.slice(2)}`;
}

export function fechaToMes(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Dada una fecha de consumo y el ciclo de la tarjeta,
 * calcula la fecha en que efectivamente se paga.
 *
 * Lógica: si el consumo es anterior al día de cierre, se paga en el mes actual
 * (en la fecha de vencimiento). Si es posterior, se paga al mes siguiente.
 */
export function calcularFechaPagoTarjeta(
  fechaConsumo: string,
  cutoffDay: number,
  dueDay: number,
): string {
  const [yyyy, mm, dd] = fechaConsumo.split("-").map(Number);
  let payYear = yyyy;
  let payMonth = mm;

  if (dd > cutoffDay) {
    // Consumo después del cierre → entra en el próximo ciclo
    payMonth += 1;
  }
  // El pago ocurre el mes siguiente al cierre
  payMonth += 1;

  if (payMonth > 12) {
    payMonth -= 12;
    payYear += 1;
  }

  const pm = String(payMonth).padStart(2, "0");
  const pd = String(Math.min(dueDay, daysInMonth(payYear, payMonth))).padStart(2, "0");
  return `${payYear}-${pm}-${pd}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Calcula la fecha de pago real de un sueldo trabajado en cierto periodo */
export function calcularFechaPagoSueldo(
  periodoTrabajado: string,
  offsetMonths = 1,
): { periodoPago: string; fechaPago: string } {
  const [yyyy, mm] = periodoTrabajado.split("-").map(Number);
  let payYear = yyyy;
  let payMonth = mm + offsetMonths;
  while (payMonth > 12) {
    payMonth -= 12;
    payYear += 1;
  }
  const pm = String(payMonth).padStart(2, "0");
  return {
    periodoPago: `${payYear}-${pm}`,
    fechaPago: `${payYear}-${pm}-05`, // día estimado de cobro
  };
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function uniqueMonths(transactions: { fechaPago: string }[]): string[] {
  const set = new Set(transactions.map(t => t.fechaPago.slice(0, 7)));
  return Array.from(set).sort().reverse();
}
