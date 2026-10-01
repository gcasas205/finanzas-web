import type { Recurrente } from "@/types";

/** Fecha "AAAA-MM-DD" del día `dia` en el mes (si el mes es más corto, el último día). */
export function fechaDelMes(mes: string, dia: number): string {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${mes}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/** Gastos fijos activos que todavía no se cargaron en el mes (ni en uno posterior). */
export function pendientesDelMes(recurrentes: Recurrente[], mes: string): Recurrente[] {
  return recurrentes
    .filter((r) => r.activo && (!r.ultimoMes || r.ultimoMes < mes))
    .sort((a, b) => a.dia - b.dia);
}
