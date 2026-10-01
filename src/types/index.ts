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
  /**
   * Solo para movimientos en USD. En un egreso (gasto en dólares) indica de qué
   * bucket de ahorro se descuenta: "regla" (automático) o un sobre puntual.
   */
  origen?: BucketOrigen;
  /** Solo para ingresos en USD: montos exactos a mediano/largo tras el piso (lo no asignado va a mediano). */
  asigMediano?: number;
  asigLargo?: number;
  /** Compra en cuotas: id compartido por todas las cuotas generadas juntas */
  grupoCuotas?: string;
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
  /** Movimiento de ingreso vinculado en Transacciones (si lo hay) */
  txId?: string;
}

export type DolarOperacionTipo = "compra" | "venta";

export interface DolarOperacion {
  id: string;
  /** Fecha de la operación (ISO yyyy-mm-dd). Puede ser de meses anteriores. */
  fecha: string;
  /** compra = comprás USD (salen pesos); venta = vendés USD (entran pesos) */
  tipo: DolarOperacionTipo;
  /** Cantidad de dólares operados */
  montoUSD: number;
  /** Precio en pesos por cada dólar (ARS/USD) usado en esta operación */
  precioARS: number;
  /** Total en pesos = montoUSD * precioARS (se recalcula al guardar) */
  totalARS: number;
  notas: string;
  createdAt: string;
  /** Compra: cuántos de los USD comprados van a mediano plazo (el piso se llena primero). */
  asigMediano?: number;
  /** Compra: cuántos van a largo plazo (S&P). Lo no asignado va a mediano. */
  asigLargo?: number;
  /** Venta: de qué bucket sale ("regla" = automático, o un sobre puntual). */
  origen?: BucketOrigen;
}

/** Cotización oficial (dolarapi.com, con dolarhoy.com de respaldo) */
export interface Cotizacion {
  compra: number;
  venta: number;
  /** Momento que informa la fuente (ISO en dolarapi), si lo da */
  actualizado: string | null;
  /** ISO en que la app trajo el dato */
  fetchedAt: string;
  /** true si es un valor de respaldo porque falló el scraping */
  fallback?: boolean;
  /** De dónde salió el dato */
  fuente?: "dolarapi" | "dolarhoy";
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

// ─── Ahorro ───────────────────────────────────────────────────────────────

/** Sobre del mediano plazo: clave estable (ej. "auto", o una generada al crearlo) */
export type SobreKey = string;

/**
 * De dónde sale una salida de USD: "regla" (automático: mediano proporcional →
 * largo → piso), "emergencia", "largo" o la clave de un sobre.
 */
export type BucketOrigen = "regla" | "emergencia" | "largo" | SobreKey;

export interface AhorroSobreConfig {
  key: SobreKey;
  nombre: string;
  /** % del pozo de mediano plazo que le corresponde a este sobre */
  pct: number;
  /** objetivo en USD */
  objetivo: number;
  /** Mes objetivo "AAAA-MM" (opcional): para calcular cuánto ahorrar por mes */
  fechaObjetivo?: string;
}

/** Pase de plata entre destinos del ahorro (no cambia la tenencia de USD). */
export interface MovAhorro {
  id: string;
  fecha: string;
  /** "emergencia", "largo" o la clave de un sobre */
  desde: string;
  hacia: string;
  montoUSD: number;
  notas: string;
  createdAt: string;
}

/**
 * Parámetros generales del plan de ahorro. Viven en la hoja "Config" del mismo
 * Google Sheets (no en el código), para editarlos sin redeployar.
 */
export interface AhorroConfig {
  /** Piso base de emergencia en USD */
  emergenciaObjetivo: number;
  /** Rendimiento anual nominal supuesto del S&P para la proyección (fracción, ej 0.07) */
  sp500RetornoAnual: number;
  sobres: AhorroSobreConfig[];
}
