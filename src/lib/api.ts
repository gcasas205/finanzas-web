/**
 * Capa de datos del cliente: una función tipada por operación contra `/api/*`.
 * Todo `fetch` de la app pasa por `request`, que:
 * - traduce errores de red a un mensaje humano,
 * - con 401 manda a /login conservando la ruta actual,
 * - con cualquier otro !ok levanta `ApiError` con `{ detail, code, field }`.
 */
import type {
  AhorroConfig,
  AppConfig,
  Cotizacion,
  DolarOperacion,
  Sueldo,
  Transaction,
} from "@/types";
import type { DatosRecibo } from "@/lib/sueldos";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    detail: string,
    public readonly field?: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

const OFFLINE = "Sin conexión con el servidor. Revisá tu internet y probá de nuevo.";

function goToLogin() {
  if (typeof window === "undefined") return;
  const volver = window.location.pathname + window.location.search;
  window.location.assign(`/login?callbackUrl=${encodeURIComponent(volver)}`);
}

async function readError(r: Response): Promise<ApiError> {
  try {
    const body = (await r.json()) as { detail?: unknown; error?: unknown; code?: unknown; field?: unknown };
    const detail = typeof body.detail === "string" ? body.detail
      : typeof body.error === "string" ? body.error
      : `Error ${r.status}`;
    return new ApiError(
      r.status,
      typeof body.code === "string" ? body.code : "unknown",
      detail,
      typeof body.field === "string" ? body.field : undefined,
    );
  } catch {
    return new ApiError(r.status, "unknown", `El servidor respondió con un error (${r.status}). Probá de nuevo.`);
  }
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "offline", OFFLINE);
  }
  if (r.status === 401) {
    goToLogin();
    throw new ApiError(401, "unauthorized", "Tu sesión venció. Ingresá de nuevo.");
  }
  if (!r.ok) throw await readError(r);
  return (await r.json()) as T;
}

function sendJson<T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown): Promise<T> {
  return request<T>(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Mensaje para mostrar de cualquier error (ApiError o inesperado). */
export function errorMessage(e: unknown, fallback = "Algo salió mal. Probá de nuevo."): string {
  if (e instanceof ApiError) return e.message;
  return fallback;
}

// ─── Movimientos ────────────────────────────────────────────────────────────

/** Lo que manda el formulario: el servidor completa id, fechaPago de tarjeta, etc. */
export type TransactionPayload = Omit<Transaction, "id" | "createdAt" | "fechaPago" | "notas"> & {
  id?: string;
  createdAt?: string;
  fechaPago?: string;
  notas?: string;
  /** Alta en cuotas: crear también las que faltan */
  crearCuotas?: boolean;
  /** Edición: aplicar los cambios a las cuotas siguientes del grupo */
  aplicarAGrupo?: boolean;
  /** Sueldo cargado a mano: datos del recibo */
  recibo?: DatosRecibo;
};

export const transactionsApi = {
  list: () => request<{ transactions: Transaction[] }>("/api/transactions"),
  create: (tx: TransactionPayload) =>
    sendJson<{ ok: true; transaction: Transaction; creados: number }>("/api/transactions", "POST", tx),
  update: (tx: TransactionPayload & { id: string }) =>
    sendJson<{ ok: true; transaction: Transaction; actualizados: number }>("/api/transactions", "PUT", tx),
  remove: (id: string, grupo = false) =>
    sendJson<{ ok: true; borrados: number }>("/api/transactions", "DELETE", { id, grupo }),
  recategorize: (ids: string[], categoria: string, subcategoria: string) =>
    sendJson<{ ok: true; updated: number }>("/api/transactions", "PATCH", { ids, categoria, subcategoria }),
};

export const sueldosApi = {
  list: () => request<{ sueldos: Sueldo[] }>("/api/sueldos"),
};

// ─── Dólares ────────────────────────────────────────────────────────────────

export type DolarOpPayload = Omit<DolarOperacion, "id" | "createdAt" | "totalARS" | "notas"> & {
  id?: string;
  createdAt?: string;
  notas?: string;
};

export const dolarApi = {
  list: () => request<{ operaciones: DolarOperacion[] }>("/api/dolar"),
  create: (op: DolarOpPayload) =>
    sendJson<{ ok: true; operacion: DolarOperacion }>("/api/dolar", "POST", op),
  update: (op: DolarOpPayload & { id: string }) =>
    sendJson<{ ok: true; operacion: DolarOperacion }>("/api/dolar", "PUT", op),
  remove: (id: string) => sendJson<{ ok: true }>("/api/dolar", "DELETE", { id }),
  cotizacion: (force = false) =>
    request<Cotizacion>(force ? "/api/dolar/cotizacion?force=1" : "/api/dolar/cotizacion"),
};

// ─── Ahorro y configuración ─────────────────────────────────────────────────

export interface ConnectionStatus {
  ok: boolean;
  error?: string;
}

export const configApi = {
  get: () => request<{ config: AppConfig; connection: ConnectionStatus }>("/api/config"),
  save: (config: Partial<AppConfig>) =>
    sendJson<{ config: AppConfig; connection: ConnectionStatus }>("/api/config", "POST", config),
  health: () => request<{ envReady: boolean }>("/api/health"),
  ahorro: () => request<{ config: AhorroConfig }>("/api/ahorro/config"),
};

// ─── Importación de PDF ─────────────────────────────────────────────────────

export const importApi = {
  /** `action: "preview"` sólo parsea; `"import"` además guarda. */
  pdf: <T>(form: FormData) => request<T>("/api/import-pdf", { method: "POST", body: form }),
};
