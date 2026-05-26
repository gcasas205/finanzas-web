export type TransactionType = "ingreso" | "egreso";
export type TransactionSource = "manual" | "tarjeta" | "recibo";

export interface Transaction {
  id: string;
  /** Fecha en que se realizó el consumo o ingreso (ISO yyyy-mm-dd) */
  fechaConsumo: string;
  /** Fecha en que efectivamente sale/entra el dinero (ISO yyyy-mm-dd) */
  fechaPago: string;
  tipo: TransactionType;
  descripcion: string;
  monto: number;
  moneda: "ARS" | "USD";
  categoria: string;
  subcategoria: string;
  fuente: TransactionSource;
  cuotaTotal: number;
  cuotaNumero: number;
  notas: string;
  createdAt: string;
}

export interface Sueldo {
  id: string;
  /** Período trabajado (ej: 2026-04) */
  periodoTrabajado: string;
  /** Período de pago real (ej: 2026-05) */
  periodoPago: string;
  empresa: string;
  cargo: string;
  bruto: number;
  neto: number;
  jubilacion: number;
  obraSocial: number;
  ley19032: number;
  otrosDescuentos: number;
  fechaPago: string;
  createdAt: string;
}

export interface AppConfig {
  nombre: string;
  mpTna: number;
  googleSheetId: string;
  googleCredsPath: string;
  cardCutoffDay: number; // día del mes en que cierra la tarjeta
  cardDueDay: number;    // día del mes en que vence el pago
  salaryPaymentOffsetMonths: number; // meses entre mes trabajado y mes de pago (1 = mes siguiente)
}

export interface CategoryConfig {
  name: string;
  subcategories: string[];
  color: string;
}

export interface MonthlySummary {
  mes: string;
  ingresos: number;
  egresos: number;
  ahorro: number;
  tasaAhorro: number;
}

export interface CategoryTotal {
  categoria: string;
  total: number;
  porcentaje: number;
  color: string;
}
